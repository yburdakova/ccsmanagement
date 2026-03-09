(function initSearchableSelectModule() {
  const openInstances = new Set();
  let globalMouseDownBound = false;

  function bindGlobalMouseDown() {
    if (globalMouseDownBound) return;
    globalMouseDownBound = true;
    document.addEventListener('mousedown', (event) => {
      openInstances.forEach((instance) => {
        if (!instance.state.isOpen) return;
        const target = event.target;
        if (instance.wrapperEl.contains(target) || instance.dropdownEl.contains(target)) return;
        instance.closeDropdown(true);
      });
    });
  }

  window.makeSearchable = function makeSearchable(selectEl) {
    if (!selectEl || selectEl.dataset.searchable === 'true') return;

    selectEl.dataset.searchable = 'true';
    bindGlobalMouseDown();

    const state = {
      isOpen: false,
      filterText: '',
      highlightedIndex: -1,
      cachedOptions: [],
      placeholderLabel: '',
      renderedOptions: [],
      _suppressSync: false,
      _enforcingNativeHide: false,
      _pendingOptionsSync: false,
      _ignoreFirstClickToggle: false
    };

    const wrapperEl = document.createElement('div');
    wrapperEl.className = 'searchable-select';
    selectEl.classList.forEach((cls) => wrapperEl.classList.add(cls));
    selectEl.insertAdjacentElement('afterend', wrapperEl);

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'searchable-select__input';
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;

    const originalId = selectEl.getAttribute('id');
    if (originalId) {
      inputEl.id = originalId;
      selectEl.removeAttribute('id');
    }
    wrapperEl.appendChild(inputEl);

    const dropdownEl = document.createElement('div');
    dropdownEl.className = 'searchable-select__dropdown';
    dropdownEl.style.display = 'none';
    document.body.appendChild(dropdownEl);

    const ensureNativeHidden = () => {
      state._enforcingNativeHide = true;
      selectEl.style.display = 'none';
      queueMicrotask(() => {
        state._enforcingNativeHide = false;
      });
    };

    ensureNativeHidden();

    const rebuildCache = () => {
      state.cachedOptions = [];
      state.placeholderLabel = '';
      for (const opt of Array.from(selectEl.options || [])) {
        const label = String(opt.textContent || '');
        if (!opt.value) {
          state.placeholderLabel = label;
        } else {
          state.cachedOptions.push({ value: String(opt.value), label });
        }
      }
    };

    const syncDisplay = () => {
      const current = String(selectEl.value || '');
      const match = state.cachedOptions.find((opt) => opt.value === current);
      if (match) {
        inputEl.value = match.label;
        inputEl.removeAttribute('data-empty');
        inputEl.placeholder = '';
      } else {
        inputEl.value = '';
        inputEl.setAttribute('data-empty', 'true');
        inputEl.placeholder = state.placeholderLabel || '';
      }
    };

    const getFilteredOptions = () => {
      const query = String(state.filterText || '').trim().toLowerCase();
      if (!query) return state.cachedOptions.slice();
      return state.cachedOptions.filter((opt) => opt.label.toLowerCase().includes(query));
    };

    const renderDropdown = () => {
      dropdownEl.innerHTML = '';
      const filtered = getFilteredOptions();
      const rendered = [];
      const hasFilter = String(state.filterText || '').trim().length > 0;
      const selectedValue = String(selectEl.value || '');

      if (!hasFilter) {
        rendered.push({ value: '', label: '-- Clear --', isPlaceholder: true, selectable: true });
      }

      filtered.forEach((opt) => {
        rendered.push({ ...opt, selectable: true });
      });

      if (!rendered.length) {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'searchable-select__option searchable-select__option--no-results';
        emptyRow.textContent = 'No results';
        dropdownEl.appendChild(emptyRow);
        state.renderedOptions = [];
        state.highlightedIndex = -1;
        return;
      }

      if (state.highlightedIndex >= rendered.length) {
        state.highlightedIndex = rendered.length - 1;
      }

      rendered.forEach((row, index) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'searchable-select__option';
        optionEl.textContent = row.label;
        if (row.isPlaceholder) optionEl.classList.add('searchable-select__option--placeholder');
        if (!row.isPlaceholder && row.value === selectedValue) {
          optionEl.classList.add('searchable-select__option--selected');
        }
        if (index === state.highlightedIndex) {
          optionEl.classList.add('searchable-select__option--highlighted');
        }
        if (row.selectable) {
          optionEl.dataset.value = row.value;
          optionEl.dataset.label = row.label;
          optionEl.addEventListener('mousedown', (event) => {
            event.preventDefault();
            selectOption(row.value);
          });
        }
        dropdownEl.appendChild(optionEl);
      });

      state.renderedOptions = rendered;
    };

    const positionDropdown = () => {
      const rect = inputEl.getBoundingClientRect();
      dropdownEl.style.left = `${rect.left}px`;
      dropdownEl.style.width = `${rect.width}px`;
      dropdownEl.style.top = `${rect.bottom + 2}px`;
      const maxHeight = Math.min(220, window.innerHeight - rect.bottom - 8);
      if (maxHeight < 120) {
        dropdownEl.style.maxHeight = '220px';
        const estimatedHeight = Math.min(dropdownEl.scrollHeight || 220, 220);
        dropdownEl.style.top = `${Math.max(8, rect.top - estimatedHeight - 2)}px`;
      } else {
        dropdownEl.style.maxHeight = `${maxHeight}px`;
      }
    };

    const openDropdown = (fromFocus = false, { selectText = !fromFocus } = {}) => {
      if (inputEl.disabled) return;
      if (!state.isOpen) {
        state.filterText = '';
        state.highlightedIndex = -1;
      }
      state.isOpen = true;
      openInstances.add(instance);
      state._ignoreFirstClickToggle = !!fromFocus;
      renderDropdown();
      dropdownEl.style.display = 'block';
      positionDropdown();
      if (selectText && typeof inputEl.select === 'function') {
        inputEl.select();
      }
    };

    const closeDropdown = (restoreDisplay) => {
      dropdownEl.style.display = 'none';
      state.isOpen = false;
      state.filterText = '';
      state.highlightedIndex = -1;
      state._ignoreFirstClickToggle = false;
      openInstances.delete(instance);
      if (restoreDisplay) syncDisplay();
    };

    const selectOption = (value) => {
      state._suppressSync = true;
      selectEl.value = String(value || '');
      state._suppressSync = false;
      syncDisplay();
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      closeDropdown(false);
    };

    const valueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (valueProp?.get && valueProp?.set) {
      Object.defineProperty(selectEl, 'value', {
        get() {
          return valueProp.get.call(this);
        },
        set(v) {
          valueProp.set.call(this, v);
          if (!state._suppressSync) syncDisplay();
        },
        configurable: true
      });
    }

    const instance = {
      state,
      wrapperEl,
      dropdownEl,
      closeDropdown
    };

    const observer = new MutationObserver((mutations) => {
      let optionsChanged = false;
      let disabledChanged = false;
      let styleChanged = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') optionsChanged = true;
        if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') disabledChanged = true;
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') styleChanged = true;
      }

      if (optionsChanged && !state._pendingOptionsSync) {
        state._pendingOptionsSync = true;
        queueMicrotask(() => {
          state._pendingOptionsSync = false;
          rebuildCache();
          if (state.isOpen) {
            renderDropdown();
            positionDropdown();
          }
          syncDisplay();
        });
      }

      if (disabledChanged) {
        inputEl.disabled = !!selectEl.disabled;
      }

      if (styleChanged) {
        const displayValue = String(selectEl.style.display || '');
        if (displayValue === 'none') {
          if (!state._enforcingNativeHide) {
            wrapperEl.style.display = 'none';
          }
        } else {
          wrapperEl.style.display = '';
          ensureNativeHidden();
        }
      }
    });

    observer.observe(selectEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'style']
    });

    inputEl.addEventListener('click', () => {
      if (!state.isOpen) {
        openDropdown(false);
        return;
      }
      if (state._ignoreFirstClickToggle) {
        state._ignoreFirstClickToggle = false;
        return;
      }
      closeDropdown(true);
    });

    inputEl.addEventListener('focus', () => {
      if (!state.isOpen) {
        openDropdown(true);
      }
    });

    inputEl.addEventListener('input', () => {
      state.filterText = inputEl.value;
      state.highlightedIndex = -1;
      if (!state.isOpen) {
        openDropdown(false, { selectText: false });
        return;
      }
      renderDropdown();
      positionDropdown();
    });

    inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        if (!state.isOpen) {
          openDropdown(false);
        }
        if (state.renderedOptions.length) {
          const nextIndex = Math.min(
            state.highlightedIndex + 1,
            state.renderedOptions.length - 1
          );
          state.highlightedIndex = Math.max(0, nextIndex);
          renderDropdown();
          dropdownEl.children[state.highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowUp') {
        if (!state.isOpen) return;
        if (state.renderedOptions.length) {
          const nextIndex = state.highlightedIndex <= 0 ? 0 : state.highlightedIndex - 1;
          state.highlightedIndex = nextIndex;
          renderDropdown();
          dropdownEl.children[state.highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
        event.preventDefault();
        return;
      }

      if (event.key === 'Enter') {
        if (state.isOpen && state.highlightedIndex >= 0) {
          const row = state.renderedOptions[state.highlightedIndex];
          if (row?.selectable) {
            selectOption(row.value);
          } else {
            closeDropdown(true);
          }
        } else {
          closeDropdown(true);
        }
        event.preventDefault();
        return;
      }

      if (event.key === 'Escape') {
        closeDropdown(true);
        return;
      }

      if (event.key === 'Tab') {
        closeDropdown(false);
      }
    });

    window.addEventListener('resize', () => {
      if (state.isOpen) positionDropdown();
    });

    window.addEventListener('scroll', () => {
      if (state.isOpen) positionDropdown();
    }, true);

    rebuildCache();
    syncDisplay();
    inputEl.disabled = !!selectEl.disabled;
  };
})();
