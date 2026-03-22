/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import AdminPage from "./pages/AdminPage";
import ReaderPage from "./pages/ReaderPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="read/:filename" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

