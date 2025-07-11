window.addEventListener('DOMContentLoaded', async () => {
  const userList = document.getElementById('user-list');

  try {
    const users = await window.electronAPI.getUsers();

    users.forEach((user) => {
      const li = document.createElement('li');
      li.textContent = `${user.first_name} ${user.last_name} (${user.login})`;
      userList.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to load users:', error);
  }
});
