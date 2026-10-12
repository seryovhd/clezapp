import React from "react";
import { Handle, Position } from "react-flow-renderer";
import { Paper, Typography, Box } from "@material-ui/core";
import { Http } from "@material-ui/icons";

const requestNode = ({ data, selected }) => {
  return (
    <Paper
      elevation={3}
      style={{
        padding: "15px",
        background: selected ? "#e3f2fd" : "#ffffff",
        border: selected ? "2px solid #1976d2" : "2px solid #90caf9",
        borderRadius: "8px",
        minWidth: "200px",
        maxWidth: "280px",
        cursor: "pointer",
      }}
    >
      <Box display="flex" alignItems="center" mb={1}>
        <Http 
          style={{ 
            color: "#1976d2", 
            marginRight: "8px",
            fontSize: "20px"
          }} 
        />
        <Typography 
          variant="h6" 
          style={{ 
            fontSize: "14px", 
            fontWeight: "bold",
            color: "#1976d2"
          }}
        >
          HTTP Request
        </Typography>
      </Box>

      {/* URL */}
      <Box mb={1}>
        <Typography 
          variant="body2" 
          style={{ 
            fontWeight: "bold",
            color: "#333",
            fontSize: "12px"
          }}
        >
          URL:
        </Typography>
        <Typography 
          variant="body2" 
          style={{ 
            color: "#666",
            fontSize: "11px",
            wordBreak: "break-all"
          }}
          noWrap
        >
          {data?.typebotIntegration?.url || "No configurado"}
        </Typography>
      </Box>

      {/* Método */}
      <Box mb={1}>
        <Typography 
          variant="body2" 
          style={{ 
            fontWeight: "bold",
            color: "#333",
            fontSize: "12px"
          }}
        >
          Método:
        </Typography>
        <Typography 
          variant="body2" 
          style={{ 
            color: getMethodColor(data?.typebotIntegration?.method),
            fontSize: "11px",
            fontWeight: "bold"
          }}
        >
          {data?.typebotIntegration?.method || "GET"}
        </Typography>
      </Box>

      {/* Guardar en variable */}
      {data?.typebotIntegration?.saveResponseTo && (
        <Box mb={1}>
          <Typography 
            variant="body2" 
            style={{ 
              fontWeight: "bold",
              color: "#333",
              fontSize: "12px"
            }}
          >
            Guardar en:
          </Typography>
          <Typography 
            variant="body2" 
            style={{ 
              color: "#388e3c",
              fontSize: "11px",
              fontStyle: "italic"
            }}
          >
            {data.typebotIntegration.saveResponseTo}
          </Typography>
        </Box>
      )}

      {/* Handles para conexiones */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: "#1976d2",
          width: "12px",
          height: "12px",
        }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "#1976d2",
          width: "12px",
          height: "12px",
        }}
      />
    </Paper>
  );
};

// Función para colores según el método HTTP
const getMethodColor = (method) => {
  switch (method?.toUpperCase()) {
    case "GET":
      return "#4caf50"; // Verde
    case "POST":
      return "#ff9800"; // Naranja
    case "PUT":
      return "#2196f3"; // Azul
    case "DELETE":
      return "#f44336"; // Rojo
    case "PATCH":
      return "#9c27b0"; // Púrpura
    default:
      return "#757575"; // Gris
  }
};

export default requestNode;