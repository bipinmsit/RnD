import React, { useState, useEffect, useContext, memo } from "react";
import { MapContextMapbox } from "../../Map/Mapbox";
import "./UIWork.css";

const UIWork = ({ getData }) => {
  const [fromData, setFromData] = useState("");
  const [toData, setToData] = useState("");

  const airports = ["MMV", "DPN", "BBB", "VTK", "JJB"];

  console.log("rerender");
  return (
    <div className="d-flex uiwork">
      <div>
        <select
          name="airports"
          id="airports"
          onChange={(e) => {
            setFromData(e.target.value);
          }}
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
          onChange={(e) => {
            setToData(e.target.value);
          }}
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
          getData({ from: fromData, to: toData });
        }}
      >
        plot
      </button>
    </div>
  );
};

export default memo(UIWork);
