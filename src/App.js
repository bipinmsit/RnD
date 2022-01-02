import { Mapbox } from "./Map/Mapbox";
import { Layers, Overlay } from "./Layers";
import "./App.css";

function App() {
  return (
    <div className="App">
      <Mapbox zoom={5} center={[80, 20]}>
        <Layers>
          <Overlay />
        </Layers>
      </Mapbox>
    </div>
  );
}

export default App;
