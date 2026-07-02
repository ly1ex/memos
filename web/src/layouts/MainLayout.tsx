import { Outlet } from "react-router-dom";

const MainLayout = () => (
  <section className="@container flex min-h-full w-full flex-col items-center">
    <Outlet />
  </section>
);

export default MainLayout;
