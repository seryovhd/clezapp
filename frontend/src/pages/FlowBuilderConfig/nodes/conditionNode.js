// nodes/conditionNode.js
import React from "react";
import { Handle, Position } from "react-flow-renderer";

const conditionNode = ({ data }) => {
  return (
    <div
      style={{
        padding: "10px",
        borderRadius: "8px",
        backgroundColor: "#1FBADC",
        color: "white",
        minWidth: "140px", // Aumentar un poco el ancho mínimo
        textAlign: "center",
        fontSize: "12px",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: "#1976d2", width: "12px", height: "12px",
        }}
      />

      <div style={{ fontWeight: "bold" }}>Condición</div>
      <div style={{ fontSize: "10px", marginTop: "5px" }}>
        <div><strong>Tipo:</strong> {data.dataType || "text"}</div>
        <div>{data.key} {data.condition} {data.value}</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "#2fff5cff", width: "12px", height: "12px", top: "30%"
        }}
        id="true"
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "#f84040ff", width: "12px", height: "12px", top: "70%"
        }}
        id="false"
      />
    </div>
  );
};

export default conditionNode;