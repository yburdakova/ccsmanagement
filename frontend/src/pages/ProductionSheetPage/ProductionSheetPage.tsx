import ProductionSheetView from './ProductionSheetView';

const ProductionSheetPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = Number(user?.id);

  if (!userId) {
    return <div className="error active">Missing user session.</div>;
  }

  return <ProductionSheetView userId={userId} title="Production Sheet" />;
};

export default ProductionSheetPage;
