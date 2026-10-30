import { Link, Route, Routes } from 'react-router';
import { EmptyState } from './components/Feedback';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { BrowsePage } from './pages/BrowsePage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { Layout } from './pages/Layout';
import { OrderPage, OrdersPage } from './pages/OrdersPage';
import { PlantPage } from './pages/PlantPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<BrowsePage />} />
        <Route path="plants/:plantId" element={<PlantPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:orderId" element={<OrderPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<EmptyState title="Page not found" action={<Link to="/">Back to the shop</Link>} />} />
      </Route>
    </Routes>
  );
}
