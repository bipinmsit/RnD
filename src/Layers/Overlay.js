import React, {
  useEffect,
  useContext,
  useState,
  useCallback,
  memo,
} from "react";
import UIWork from "./Path/UIWork";
import { MapContextMapbox } from "../Map/Mapbox";
import ATSLine from "../Data/NewATS.geojson";
import WayPoint from "../Data/NewWayPoint.geojson";
import * as turf from "@turf/turf";

const Overlay = () => {
  const { map } = useContext(MapContextMapbox);
  const [atsLines, setAtsLines] = useState([]);
  const [atsPoints, setAtsPoints] = useState([]);
  const [fromTo, setFromTo] = useState({ from: "", to: "" });

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

  const courseCheck = (currCourse, prevCourse) => {
    return Math.abs(currCourse - prevCourse) < 180
      ? Math.abs(currCourse - prevCourse)
      : currCourse >= prevCourse
      ? prevCourse + (360 - currCourse)
      : currCourse + (360 - prevCourse);
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

    if (fromTo.from === "" && fromTo.to === "") {
      return;
    }

    // const buffered = turf.buffer(
    //   turf.featureCollection([
    //     turf.lineString([
    //       getCoords("MMV", atsPoints.features),
    //       getCoords("DPN", atsPoints.features),
    //     ]),
    //   ]),
    //   70,
    //   {
    //     units: "nauticalmiles",
    //   }
    // );

    const buffered = turf.buffer(
      turf.featureCollection([
        turf.lineString([
          getCoords(fromTo.from, atsPoints.features),
          getCoords(fromTo.to, atsPoints.features),
        ]),
      ]),
      300,
      {
        units: "nauticalmiles",
      }
    );

    const getBbox = turf.bbox(buffered);
    map.fitBounds([
      [getBbox[0], getBbox[1]], // southwestern corner of the bounds
      [getBbox[2], getBbox[3]], // northeastern corner of the bounds
    ]);

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

    // Finding unwanted line segments
    let time = 0;
    let NIL = -1;
    let unwantedLines = [];
    const bridge = () => {
      // Mark all the vertices as not visited
      let visited = new Array(airports.length);
      let disc = new Array(airports.length);
      let low = new Array(airports.length);
      let parent = new Array(airports.length);

      // Initialize parent and visited, and ap(articulation point)
      // arrays
      for (let i = 0; i < airports.length; i++) {
        parent[i] = NIL;
        visited[i] = false;
      }

      // Call the recursive helper function to find Bridges
      // in DFS tree rooted with vertex 'i'
      for (let i = 0; i < airports.length; i++)
        if (visited[i] === false)
          bridgeUtil(airports[i], visited, disc, low, parent);
    };

    const bridgeUtil = (u, visited, disc, low, parent) => {
      // Mark the current node as visited
      let indexB = getIndex(u, airports);
      visited[indexB] = true;

      // Initialize discovery time and low value
      disc[indexB] = low[indexB] = ++time;

      // Go through all vertices adjacent to this
      //   console.log(adjacencyList);
      let uniqArr = [...new Set(adjacencyList.get(u))];
      for (let i of uniqArr) {
        let v = i; // v is current adjacent of u

        // If v is not visited yet, then make it a child
        // of u in DFS tree and recur for it.
        // If v is not visited yet, then recur for it
        let indexA = getIndex(v, airports);
        if (!visited[indexA]) {
          parent[indexA] = u;
          bridgeUtil(v, visited, disc, low, parent);

          // Check if the subtree rooted with v has a
          // connection to one of the ancestors of u
          low[indexB] = Math.min(low[indexB], low[indexA]);

          // If the lowest vertex reachable from subtree
          // under v is below u in DFS tree, then u-v is
          // a bridge
          if (low[indexA] > disc[indexB]) {
            // document.write(u + " " + v + "<br>");
            unwantedLines.push([...[u, v]]);
          }
        }

        // Update low value of u for parent function calls.
        else if (v !== parent[indexB])
          low[indexB] = Math.min(low[indexB], disc[indexA]);
      }
    };

    bridge();

    const finalFilteredLines = () => {
      let indices = [];
      let tempArr = [...filteredLines];

      for (let i = 0; i < unwantedLines.length; i++) {
        // console.log(unwantedLines[i]);
        filteredLines.filter((val, index) => {
          if (
            (val.properties.From === unwantedLines[i][0] &&
              val.properties.To === unwantedLines[i][1]) ||
            (val.properties.From === unwantedLines[i][1] &&
              val.properties.To === unwantedLines[i][0])
          ) {
            indices.push(index);
          }
        });
      }

      let finalLines = tempArr.filter(function (value, index) {
        return indices.indexOf(index) === -1;
      });

      return finalLines;
    };

    let finalRoutes = [];
    for (let i = 0; i < finalFilteredLines().length; i++) {
      finalRoutes.push([
        finalFilteredLines()[i].properties.From,
        finalFilteredLines()[i].properties.To,
      ]);
    }

    const finalUnqRoutes = Array.from(
      new Set(finalRoutes.map(JSON.stringify)),
      JSON.parse
    );

    // Creates graph
    let finalAdjacencyList = new Map();
    const finalAddNode = (nodeList) => {
      finalAdjacencyList.set(nodeList, []);
    };

    const finalAddEdge = (org, dest) => {
      if (finalAdjacencyList.get(org) && finalAdjacencyList.get(dest)) {
        finalAdjacencyList.get(org).push(dest);
        finalAdjacencyList.get(dest).push(org);
      }
    };

    // Create the Graph
    airports.forEach(finalAddNode);
    finalUnqRoutes.forEach((route) => finalAddEdge(...route));

    // Printing all possible paths
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
        if (!isVisited[indexA]) {
          if (localPathList.length > 1) {
            let course1 = filteredLines.filter(
              (val) =>
                (val.properties.From ===
                  localPathList[localPathList.length - 2] &&
                  val.properties.To ===
                    localPathList[localPathList.length - 1]) ||
                (val.properties.To ===
                  localPathList[localPathList.length - 2] &&
                  val.properties.From ===
                    localPathList[localPathList.length - 1])
            )[0].properties.Course;

            let course2 = filteredLines.filter(
              (val) =>
                (val.properties.From ===
                  localPathList[localPathList.length - 1] &&
                  val.properties.To === uniqArr[i]) ||
                (val.properties.To ===
                  localPathList[localPathList.length - 1] &&
                  val.properties.From === uniqArr[i])
            )[0].properties.Course;

            if (courseCheck(course2, course1) < 25) {
              localPathList.push(uniqArr[i]);
            } else {
              continue;
            }
          } else {
            localPathList.push(uniqArr[i]);
          }

          printAllPathsUtil(uniqArr[i], d, isVisited, localPathList);

          localPathList.splice(localPathList.indexOf(uniqArr[i]), 1);
        }
      }

      // Mark the current node
      isVisited[indexCurr] = false;
    };

    printAllPaths(fromTo.from, fromTo.to);
    console.log(possiblePaths);

    let possiblePathCoords = [];
    for (let i = 0; i < possiblePaths.length; i++) {
      let tempArr2 = [];
      for (let j = 0; j < possiblePaths[i].length; j++) {
        tempArr2.push(getCoords(possiblePaths[i][j], filteredPoints));
      }
      possiblePathCoords.push(tempArr2);
    }

    const flattenArray = [].concat.apply([], possiblePathCoords);
    // console.log(flattenArray);

    map.on("render", () => {
      if (!map.loaded()) {
        return;
      }

      if (!map.getSource("Buffer")) {
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

        // Filtered ATS Line
        map.addSource("filteredLines", {
          type: "geojson",
          data: turf.featureCollection(filteredLines),
        });
        map.addLayer({
          id: "filteredLines",
          type: "line",
          source: "filteredLines",
          paint: {},
          layout: {
            visibility: "visible",
          },
        });

        map.addSource("finalFilteredLines", {
          type: "geojson",
          data: turf.featureCollection(finalFilteredLines()),
        });
        map.addLayer({
          id: "finalFilteredLines",
          type: "line",
          source: "finalFilteredLines",
          paint: {
            "line-color": "red",
            "line-width": 3,
            "line-opacity": 0.5,
          },
          layout: {
            visibility: "visible",
          },
        });

        // path based on course
        map.addSource("flattenArray", {
          type: "geojson",
          data: turf.featureCollection([turf.lineString(flattenArray)]),
        });
        map.addLayer({
          id: "flattenArray",
          type: "line",
          source: "flattenArray",
          paint: {
            "line-color": "blue",
            "line-width": 3,
            "line-opacity": 0.5,
          },
          layout: {
            visibility: "visible",
          },
        });
      }
    });

    return () => {
      map.off();
      map.remove();
      // map.getSource("Buffer")=undefined;
      //   map.removeLayer("Buffer");
      //   map.removeSource("Buffer");
      // map.removeLayer("NewWayPointLabels");
      // map.removeSource("NewWayPointLabels");
      // map.removeLayer("filteredLines");
      // map.removeSource("filteredLines");
      // map.removeLayer("finalFilteredLines");
      // map.removeSource("finalFilteredLines");
      // map.removeLayer("flattenArray");
      // map.removeSource("flattenArray");
    };
  }, [atsLines, atsPoints, map, fromTo.from, fromTo.to]);

  const getData = useCallback((e) => {
    setFromTo({ from: e.from, to: e.to });
  }, []);

  return (
    <div>
      <UIWork getData={getData} />
    </div>
  );
};

export default memo(Overlay);
