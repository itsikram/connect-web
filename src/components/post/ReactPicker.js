import React from "react";
import {
  REACT_LIST,
  getReactIcon,
  getReactLabel,
} from "../../utils/reactTypes";
import "./ReactPicker.css";

export const ReactPicker = ({
  reactType,
  onSelect,
  className = "post-react-container",
}) => (
  <div className={className}>
    {REACT_LIST.map((react) => (
      <div
        key={react.key}
        className={`react react-${react.key} ${reactType === react.key ? "reacted" : ""}`}
        onClick={(e) => onSelect(react.key, e)}
        title={react.label}
      >
        <img src={react.icon} alt={react.label} />
      </div>
    ))}
  </div>
);

export const PlacedReactIcons = ({ placedReacts = [] }) => (
  <>
    {REACT_LIST.filter((react) => placedReacts.includes(react.key)).map(
      (react) => (
        <div className="react" key={react.key}>
          <img src={react.icon} alt={react.label} />
        </div>
      ),
    )}
  </>
);

export const CurrentReactIcon = ({ reactType }) => {
  const type = reactType || "like";
  return <img src={getReactIcon(type)} alt={getReactLabel(type)} />;
};

export default ReactPicker;
