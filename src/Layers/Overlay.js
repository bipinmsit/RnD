import React, { useEffect, useContext, useState } from "react";
import { MapContextMapbox } from "../Map/Mapbox";
import ATSLine from "../Data/NewATS.geojson";
import WayPoint from "../Data/NewWayPoint.geojson";
import * as turf from "@turf/turf";

const Overlay = () => {
  const { map } = useContext(MapContextMapbox);
  const [atsLines, setAtsLines] = useState([]);
  const [atsPoints, setAtsPoints] = useState([]);

  const getCoords = (name, arr) => {
    const index = arr.findIndex(
      (airportName) => airportName.properties.PNAME === name
    );
    const feat = arr[index];
    const coords = feat.geometry.coordinates;

    return coords;
  };

  const getIndex = (name, arr) => {
    const index = arr.findIndex((airportName) => airportName === name);

    return index;
  };

  useEffect(() => {
    fetch(ATSLine)
      .then((res) => res.json())
      .then((out) => setAtsLines(out));

    fetch(WayPoint)
      .then((res) => res.json())
      .then((out) => setAtsPoints(out));
  }, []);

  useEffect(() => {
    if (!map) {
      return;
    }

    if (atsPoints.length === 0) {
      return;
    }

    if (atsLines.length === 0) {
      return;
    }

    const buffered = turf.buffer(
      turf.featureCollection([
        turf.lineString([
          getCoords("MMV", atsPoints.features),
          getCoords("DPN", atsPoints.features),
        ]),
      ]),
      60,
      {
        units: "nauticalmiles",
      }
    );

    let possiblePaths = [];
    let filteredLines = [];
    let filteredPoints = [];
    let airports = [];
    let routes = [];

    turf.featureEach(atsLines, (line) => {
      if (
        turf.booleanContains(
          buffered.features[0],
          turf.bboxPolygon(turf.bbox(line))
        )
      ) {
        filteredLines.push(line);
      }
    });

    turf.featureEach(atsPoints, (point) => {
      if (turf.inside(point, buffered.features[0])) {
        filteredPoints.push(point);
      }
    });

    for (let i = 0; i < filteredPoints.length; i++) {
      airports.push(filteredPoints[i].properties.PNAME);
    }

    for (let i = 0; i < filteredLines.length; i++) {
      routes.push([
        filteredLines[i].properties.From,
        filteredLines[i].properties.To,
      ]);
    }

    const unqRoutes = Array.from(
      new Set(routes.map(JSON.stringify)),
      JSON.parse
    );

    // Creates graph
    let adjacencyList = new Map();
    const addNode = (nodeList) => {
      adjacencyList.set(nodeList, []);
    };

    const addEdge = (org, dest) => {
      if (adjacencyList.get(org) && adjacencyList.get(dest)) {
        adjacencyList.get(org).push(dest);
        adjacencyList.get(dest).push(org);
      }
    };

    // Create the Graph
    airports.forEach(addNode);
    unqRoutes.forEach((route) => addEdge(...route));

    const printAllPaths = (s, d) => {
      let isVisited = new Array(airports.length);
      for (let i = 0; i < airports.length; i++) isVisited[i] = false;
      let pathList = [];

      // add source to path[]
      pathList.push(s);

      // Call recursive utility
      printAllPathsUtil(s, d, isVisited, pathList);
    };

    const printAllPathsUtil = (u, d, isVisited, localPathList) => {
      if (u === d) {
        possiblePaths.push([...localPathList]);

        return;
      }

      let indexCurr = getIndex(u, airports);
      isVisited[indexCurr] = true;

      let uniqArr = [...new Set(adjacencyList.get(u))];
      for (let i = 0; i < uniqArr.length; i++) {
        let indexA = getIndex(uniqArr[i], airports);
        if (!isVisited[indexA] && isVisited[indexA] !== undefined) {
          // store current node
          // in path[]
          localPathList.push(uniqArr[i]);
          printAllPathsUtil(uniqArr[i], d, isVisited, localPathList);

          // remove current node
          // in path[]
          localPathList.splice(localPathList.indexOf(uniqArr[i]), 1);
        }
      }

      // Mark the current node
      isVisited[indexCurr] = false;
    };

    printAllPaths("MMV", "DPN");
    console.log(possiblePaths);

    map.on("load", () => {
      // Filtered ATS Line
      map.addSource("filteredFeature", {
        type: "geojson",
        data: turf.featureCollection(filteredLines),
      });
      map.addLayer({
        id: "filteredFeature",
        type: "line",
        source: "filteredFeature",
        paint: {},
        layout: {
          visibility: "visible",
        },
      });

      // Buffered Polygon
      map.addSource("Buffer", {
        type: "geojson",
        data: buffered,
      });
      map.addLayer({
        id: "Buffer",
        type: "fill",
        source: "Buffer",
        paint: {
          "fill-color": "grey",
          "fill-opacity": 0.2,
        },
        layout: {
          visibility: "visible",
        },
      });
    });

    // Adding NewWayPoint Labels
    map.addSource("NewWayPointLabels", {
      type: "vector",
      url: "mapbox://rahulsds.a2ttfiym",
    });
    map.addLayer({
      id: "NewWayPointLabels",
      type: "symbol",
      source: "NewWayPointLabels",
      "source-layer": "NewWayPoint-6ug16e",
      layout: {
        visibility: "visible",
        "text-field": ["get", "PNAME"],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.5,
        "text-justify": "auto",
        "text-size": 8,
      },
      paint: {
        // "text-color": "blue",
      },
    });

    return () => {};
  }, [atsLines, atsPoints, map]);

  return null;
};

export default Overlay;
