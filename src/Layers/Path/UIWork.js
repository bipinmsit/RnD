import React, { useState, useEffect, useContext, memo } from "react";
import { MapContextMapbox } from "../../Map/Mapbox";
import "./UIWork.css";

const UIWork = ({ getData }) => {
  const [fromData, setFromData] = useState("");
  const [toData, setToData] = useState("");

  const { map } = useContext(MapContextMapbox);

  const airports = ["MMV", "DPN", "BBB", "VTK", "JJB"];

  let from = "";
  let to = "";

  // if (map) {
  //   map.on("idle", () => {
  //     console.log(map.getLayer("finalFilteredLines"));
  //     console.log(map.getLayoutProperty("finalFilteredLines", "visibility"));
  //   });
  // }

  return (
    <div className="d-flex uiwork">
      <div>
        <select
          name="airports"
          id="airports"
          onChange={(e) => (from = e.target.value)}
        >
          <option value="select">From</option>
          {airports.map((airport, index) => {
            return (
              <option key={index} value={airport}>
                {airport}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <select
          name="airports"
          id="airports"
          onChange={(e) => (to = e.target.value)}
        >
          <option value="select">To</option>
          {airports.map((airport, index) => {
            return (
              <option key={index} value={airport}>
                {airport}
              </option>
            );
          })}
        </select>
      </div>

      <button
        type="button"
        onClick={() => {
          getData({ from: from, to: to });
        }}
      >
        plot
      </button>
    </div>
  );
};

export default memo(UIWork);
