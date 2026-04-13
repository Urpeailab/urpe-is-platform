import * as React from "react";

const Tooltip = ({ children, content, position = "top" }) => {
  const [visible, setVisible] = React.useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2"
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg border border-gray-700 whitespace-nowrap ${positionClasses[position]}`}
        >
          {content}
          <div className={`absolute w-2 h-2 bg-gray-800 border border-gray-700 transform rotate-45 ${
            position === "top" ? "bottom-[-5px] left-1/2 -translate-x-1/2 border-t-0 border-l-0" :
            position === "bottom" ? "top-[-5px] left-1/2 -translate-x-1/2 border-b-0 border-r-0" :
            position === "left" ? "right-[-5px] top-1/2 -translate-y-1/2 border-t-0 border-r-0" :
            "left-[-5px] top-1/2 -translate-y-1/2 border-b-0 border-l-0"
          }`}></div>
        </div>
      )}
    </div>
  );
};

export { Tooltip };
