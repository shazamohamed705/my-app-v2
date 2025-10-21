import { BrowserRouter, Routes, Route } from "react-router-dom";
import TransportContract from "./TransportContract/TransportContract";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* أي id يجي في الرابط يعرض الرحلة */}
          <Route path="/trips/:id" element={<TransportContract />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
