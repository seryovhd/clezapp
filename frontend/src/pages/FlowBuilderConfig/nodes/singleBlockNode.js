import {
  AccessTime,
  ArrowForwardIos,
  ContentCopy,
  Delete,
  Description,
  Image,
  LibraryBooks,
  Message,
  MicNone,
  Videocam
} from "@mui/icons-material";
import React, { memo } from "react";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Typography } from "@mui/material";

// Reemplaza todo el código dentro del return por esto:
export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();

  // ✅ AGREGAR VERIFICACIÓN DE SEGURIDAD
  if (!data || !data.seq || !data.elements) {
    return (
      <div
        style={{
          backgroundColor: "#FEFAFA",
          padding: "8px",
          borderRadius: "8px",
          border: "1px solid rgba(236, 88, 88, 0.25)",
          boxShadow: "rgba(0, 0, 0, 0.05) 0px 3px 5px"
        }}
      >
        <Handle type="target" position="left" style={handleStyle} isConnectable={isConnectable}>
          <ArrowForwardIos sx={handleIconStyle} />
        </Handle>

        <div style={headerStyle}>
          <ContentCopy onClick={() => handleAction("duplicate", id, storageItems)} sx={iconStyle} />
          <Delete onClick={() => handleAction("delete", id, storageItems)} sx={iconStyle} />
        </div>

        <div style={titleStyle}>
          <LibraryBooks sx={titleIconStyle} />
          <div style={titleTextStyle}>Contenido</div>
        </div>

        <div style={contentStyle}>
          <div style={errorStyle}>
            ❌ Error: Datos del nodo no disponibles
          </div>
        </div>

        <Handle type="source" position="right" id="a" style={sourceHandleStyle} isConnectable={isConnectable}>
          <ArrowForwardIos sx={handleIconStyle} />
        </Handle>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#FEFAFA",
        padding: "8px",
        borderRadius: "8px",
        border: "1px solid rgba(236, 88, 88, 0.25)",
        boxShadow: "rgba(0, 0, 0, 0.05) 0px 3px 5px"
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          background: "#0000FF",
          width: "18px",
          height: "18px",
          top: "20px",
          left: "-12px",
          cursor: 'pointer'
        }}
        onConnect={params => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#ffff",
            width: "10px",
            height: "10px",
            marginLeft: "3.5px",
            marginBottom: "1px",
            pointerEvents: "none"
          }}
        />
      </Handle>

      <div style={headerStyle}>
        <ContentCopy onClick={() => handleAction("duplicate", id, storageItems)} sx={iconStyle} />
        <Delete onClick={() => handleAction("delete", id, storageItems)} sx={iconStyle} />
      </div>

      <div style={titleStyle}>
        <LibraryBooks sx={titleIconStyle} />
        <div style={titleTextStyle}>Contenido</div>
      </div>

      <div style={contentStyle}>
        {data.seq.map(item => {
          // ✅ AGREGAR VERIFICACIÓN PARA CADA ELEMENTO
          const element = data.elements.find(itemLoc => itemLoc.number === item);
          if (!element) return null;

          return (
            <div key={item} style={itemStyle}>
              {item.includes("message") && (
                <MessageItem element={element} />
              )}
              {item.includes("interval") && (
                <IntervalItem element={element} />
              )}
              {item.includes("img") && (
                <ImageItem element={element} />
              )}
              {item.includes("imgUrl") && (
                <ImageUrlItem element={element} />
              )}
              {item.includes("audio") && (
                <AudioItem element={element} />
              )}
              {item.includes("video") && (
                <VideoItem element={element} />
              )}
              {/* ✅ AGREGAR CASOS PARA DOCUMENTOS */}
              {item.includes("document") && !item.includes("documentUrl") && (
                <DocumentItem element={element} />
              )}
              {item.includes("documentUrl") && (
                <DocumentUrlItem element={element} />
              )}
            </div>
          );
        })}
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={sourceHandleStyle}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos sx={handleIconStyle} />
      </Handle>
    </div>
  );
});

// ✅ AGREGAR COMPONENTES AUXILIARES PARA MEJOR ORGANIZACIÓN
const handleAction = (action, id, storageItems) => {
  storageItems.setNodesStorage(id);
  storageItems.setAct(action);
};

const headerStyle = {
  display: "flex",
  position: "absolute",
  right: 5,
  top: 5,
  cursor: "pointer",
  gap: 6
};

const iconStyle = { width: "12px", height: "12px", color: "#EC5858" };

const titleStyle = {
  color: "#ededed",
  fontSize: "16px",
  flexDirection: "row",
  display: "flex"
};

const titleIconStyle = {
  width: "16px",
  height: "16px",
  marginRight: "4px",
  marginTop: "4px",
  color: "#EC5858"
};

const titleTextStyle = { color: "#232323", fontSize: "16px" };

const contentStyle = { color: "#232323", fontSize: "12px", width: 180 };

const itemStyle = {
  backgroundColor: "#F6EEEE",
  marginBottom: "3px",
  borderRadius: "5px"
};

const errorStyle = {
  padding: "10px",
  textAlign: "center",
  color: "#EC5858",
  fontSize: "10px"
};

const handleStyle = {
  background: "#0000FF",
  width: "18px",
  height: "18px",
  top: "20px",
  left: "-12px",
  cursor: 'pointer'
};

const sourceHandleStyle = {
  background: "#0000FF",
  width: "18px",
  height: "18px",
  top: "90%",
  right: "-11px",
  cursor: 'pointer'
};

const handleIconStyle = {
  color: "#ffff",
  width: "10px",
  height: "10px",
  marginLeft: "3.5px",
  marginBottom: "1px",
  pointerEvents: "none"
};

// ✅ COMPONENTES PARA CADA TIPO DE ELEMENTO
const MessageItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={centerStyle}>
      <Message sx={{ color: "#EC5858" }} />
    </div>
    <Typography textAlign={"center"} sx={textStyle}>
      {element.value}
    </Typography>
  </div>
);

const IntervalItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={centerStyle}>
      <AccessTime sx={{ color: "#EC5858" }} />
    </div>
    <Typography textAlign={"center"} sx={textStyle}>
      {element.value} segundos
    </Typography>
  </div>
);

const ImageItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={centerStyle}>
      <Image sx={{ color: "#EC5858" }} />
    </div>
    <Typography textAlign={"center"} sx={textStyle}>
      {element.original}
    </Typography>
  </div>
);

const ImageUrlItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={{ ...centerStyle, position: "relative" }}>
      <Image sx={{ color: "#1976d2" }} />
      {/* Indicador de variable */}
      {element.value?.includes("{{") && (
        <div style={variableIndicatorStyle}>
          V
        </div>
      )}
    </div>
    <Typography textAlign={"center"} sx={{ ...textStyle, color: "#1976d2" }}>
      {element.value}
    </Typography>
  </div>
);

const AudioItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={centerStyle}>
      <MicNone sx={{ color: "#EC5858" }} />
    </div>
    <Typography textAlign={"center"} sx={textStyle}>
      {element.original}
    </Typography>
  </div>
);

const VideoItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={centerStyle}>
      <Videocam sx={{ color: "#EC5858" }} />
    </div>
    <Typography textAlign={"center"} sx={textStyle}>
      {element.original}
    </Typography>
  </div>
);
// ✅ COMPONENTE PARA DOCUMENTO LOCAL
const DocumentItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={centerStyle}>
      <Description sx={{ color: "#28a745" }} />
    </div>
    <Typography textAlign={"center"} sx={{ ...textStyle, color: "#28a745" }}>
      {element.original}
    </Typography>
    {element.caption && (
      <Typography textAlign={"center"} sx={{ ...textStyle, fontSize: "8px", color: "#666" }}>
        {element.caption}
      </Typography>
    )}
  </div>
);

// ✅ COMPONENTE PARA DOCUMENTO POR URL
const DocumentUrlItem = ({ element }) => (
  <div style={{ gap: "5px", padding: "6px" }}>
    <div style={{ ...centerStyle, position: "relative" }}>
      <Description sx={{ color: "#17a2b8" }} />
      {/* Indicador de variable */}
      {element.value?.includes("{{") && (
        <div style={variableIndicatorStyle}>
          V
        </div>
      )}
    </div>
    <Typography textAlign={"center"} sx={{ ...textStyle, color: "#17a2b8" }}>
      {element.fileName || "documento.pdf"}
    </Typography>
    {element.caption && (
      <Typography textAlign={"center"} sx={{ ...textStyle, fontSize: "8px", color: "#666" }}>
        {element.caption}
      </Typography>
    )}
    {element.value?.includes("{{") && (
      <Typography textAlign={"center"} sx={{ ...textStyle, fontSize: "8px", fontStyle: "italic", color: "#17a2b8" }}>
        Con variables
      </Typography>
    )}
  </div>
);
const centerStyle = {
  display: "flex",
  position: "relative",
  flexDirection: "row",
  justifyContent: "center"
};

const textStyle = {
  textOverflow: "ellipsis",
  fontSize: "10px",
  whiteSpace: "nowrap",
  overflow: "hidden"
};

const variableIndicatorStyle = {
  position: "absolute",
  top: -5,
  right: -5,
  backgroundColor: "#1976d2",
  color: "white",
  borderRadius: "50%",
  width: "12px",
  height: "12px",
  fontSize: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};
