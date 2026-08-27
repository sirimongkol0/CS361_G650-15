import { RouterProvider } from "react-router";
import { router } from "./routes";
import { RoleProvider } from "./context/RoleContext";

export default function App() {
  return (
    <RoleProvider>
      <RouterProvider router={router} />
    </RoleProvider>
  );
}
