import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { SiOpenai } from "react-icons/si";
import typebotIcon from "../../assets/typebot-ico.png";
import { HiOutlinePuzzle } from "react-icons/hi";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

import audioNode from "./nodes/audioNode";
import typebotNode from "./nodes/typebotNode";
import openaiNode from "./nodes/openaiNode";
import deepseekNode from "./nodes/deepseekNode"; // Nuevo nodo
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import questionNode from "./nodes/questionNode";
import RemoveEdge from "./nodes/removeEdge";
import singleBlockNode from "./nodes/singleBlockNode";
import ticketNode from "./nodes/ticketNode";
import Grid from "@mui/material/Grid";

import api from "../../services/api";

import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import { Box, CircularProgress } from "@material-ui/core";
import BallotIcon from "@mui/icons-material/Ballot";

import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  onElementsRemove,
  useReactFlow,
} from "react-flow-renderer";

import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import FlowBuilderTypebotModal from "../../components/FlowBuilderAddTypebotModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderAddQuestionModal from "../../components/FlowBuilderAddQuestionModal";
import FlowBuilderDeepSeekModal from "../../components/FlowBuilderAddDeepSeekModal";
import {
  AccessTime,
  CallSplit,
  DynamicFeed,
  Image,
  LibraryBooks,
  Message,
  MicNone,
  RocketLaunch,
  Videocam,
  Collections,
  SmartToy,
} from "@mui/icons-material";

import { useNodeStorage } from "../../stores/useNodeStorage";
import { ConfirmationNumber } from "@material-ui/icons";
import { yellow } from "@material-ui/core/colors";
const DeepSeekIcon = () => (
  <svg width="24" height="24" viewBox="0 0 60 60" fill="#4d6bfe">
    <path d="m57.61,13.47c-0.59,-0.29 -0.85,0.27 -1.2,0.55c-0.12,0.09 -0.22,0.21 -0.32,0.32c-0.87,0.93 -1.88,1.54 -3.21,1.46c-1.94,-0.11 -3.6,0.5 -5.07,1.99c-0.31,-1.83 -1.34,-2.93 -2.92,-3.63c-0.82,-0.36 -1.66,-0.73 -2.23,-1.52c-0.41,-0.56 -0.52,-1.19 -0.72,-1.81c-0.13,-0.37 -0.25,-0.76 -0.69,-0.82c-0.46,-0.07 -0.65,0.32 -0.83,0.65c-0.73,1.34 -1.02,2.81 -0.99,4.31c0.07,3.36 1.49,6.04 4.31,7.94c0.32,0.22 0.4,0.44 0.3,0.76c-0.19,0.65 -0.42,1.29 -0.62,1.95c-0.13,0.42 -0.32,0.51 -0.77,0.32c-1.55,-0.64 -2.89,-1.6 -4.07,-2.76c-2.01,-1.94 -3.82,-4.08 -6.08,-5.75c-0.53,-0.4 -1.06,-0.76 -1.61,-1.11c-2.31,-2.24 0.3,-4.08 0.9,-4.3c0.64,-0.23 0.22,-1.01 -1.82,-1c-2.04,0.01 -3.91,0.69 -6.29,1.6c-0.35,0.14 -0.72,0.24 -1.09,0.32c-2.16,-0.41 -4.41,-0.5 -6.75,-0.23c-4.42,0.49 -7.94,2.57 -10.53,6.14c-3.12,4.28 -3.85,9.14 -2.95,14.22c0.94,5.35 3.67,9.78 7.86,13.24c4.35,3.59 9.36,5.35 15.08,5.01c3.47,-0.2 7.34,-0.67 11.7,-4.36c1.09,0.55 2.25,0.77 4.16,0.93c1.48,0.14 2.9,-0.07 4,-0.3c1.72,-0.36 1.6,-1.96 0.98,-2.25c-5.05,-2.35 -3.94,-1.39 -4.95,-2.17c2.57,-3.03 6.43,-6.18 7.94,-16.4c0.12,-0.81 0.02,-1.32 0,-1.97c-0.01,-0.4 0.08,-0.56 0.54,-0.61c1.27,-0.14 2.49,-0.49 3.62,-1.11c3.27,-1.78 4.59,-4.72 4.9,-8.23c0.05,-0.54 -0.01,-1.1 -0.58,-1.38zm-28.49,31.65c-4.89,-3.84 -7.26,-5.11 -8.24,-5.05c-0.92,0.05 -0.76,1.1 -0.55,1.78c0.21,0.68 0.48,1.14 0.87,1.73c0.26,0.4 0.45,0.98 -0.27,1.42c-1.57,0.97 -4.31,-0.33 -4.44,-0.4c-3.19,-1.87 -5.85,-4.35 -7.73,-7.74c-1.82,-3.26 -2.87,-6.76 -3.04,-10.5c-0.05,-0.9 0.22,-1.22 1.12,-1.38c1.18,-0.22 2.39,-0.27 3.58,-0.09c4.99,0.73 9.24,2.96 12.8,6.49c2.03,2.02 3.57,4.42 5.16,6.77c1.68,2.5 3.5,4.88 5.8,6.83c0.82,0.68 1.47,1.2 2.09,1.58c-1.88,0.21 -5.01,0.26 -7.15,-1.44zm2.34,-15.08c0,-0.4 0.32,-0.72 0.73,-0.72c0.09,0 0.17,0.02 0.24,0.05c0.11,0.04 0.2,0.09 0.27,0.17c0.13,0.13 0.2,0.31 0.2,0.5c0,0.41 -0.32,0.72 -0.72,0.72s-0.72,-0.31 -0.72,-0.72zm7.29,3.74c-0.47,0.19 -0.94,0.36 -1.39,0.37c-0.69,0.04 -1.45,-0.24 -1.87,-0.59c-0.64,-0.54 -1.1,-0.84 -1.29,-1.78c-0.08,-0.4 -0.03,-1.02 0.04,-1.37c0.16,-0.77 -0.02,-1.26 -0.56,-1.71c-0.44,-0.36 -1,-0.46 -1.61,-0.46c-0.23,0 -0.44,-0.1 -0.6,-0.18c-0.25,-0.13 -0.46,-0.45 -0.26,-0.84c0.06,-0.13 0.37,-0.44 0.45,-0.49c0.83,-0.48 1.79,-0.32 2.68,0.03c0.82,0.34 1.45,0.96 2.34,1.84c0.92,1.05 1.09,1.34 1.61,2.14c0.41,0.62 0.79,1.25 1.04,1.98c0.16,0.46 -0.04,0.83 -0.58,1.06z" />
  </svg>
);
const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    position: "relative",
    backgroundColor: "#F8F9FA",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  },
  flowContainer: {
    flex: 1, // ✅ NUEVO - Esto hará que ocupe el espacio restante
    minHeight: 0, // ✅ NUEVO - Importante para flex
  },
  outlinedButton: {
    textTransform: "none",
    color: "#9c27b0",
    border: "1px solid rgba(156, 39, 176, 0.5)",
    borderRadius: "8px",
    padding: "6px 16px",
    fontWeight: "700",
    marginRight: theme.spacing(1),
    "&:hover": {
      backgroundColor: "#f8e3f8",
      borderColor: "#7c207e",
    },
  },
}));

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  typebot: typebotNode,
  openai: openaiNode,
  deepseek: deepseekNode, // Agregar el nuevo tipo
  question: questionNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge,
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio del flujo" },
    type: "start",
  }
];

const initialEdges = [];

// Función para comparar arrays de nodos (ignora propiedades temporales)
const areNodeArraysEqual = (current, original) => {
  if (!current || !original) return false;
  if (current.length !== original.length) return false;

  return current.every((node, index) => {
    const origNode = original[index];
    if (!origNode) return false;

    return (
      node.id === origNode.id &&
      node.type === origNode.type &&
      JSON.stringify(node.data) === JSON.stringify(origNode.data) &&
      node.position.x === origNode.position.x &&
      node.position.y === origNode.position.y
    );
  });
};

// Función para comparar arrays de conexiones
const areEdgeArraysEqual = (current, original) => {
  if (!current || !original) return false;
  if (current.length !== original.length) return false;

  // Ordenar para comparación consistente
  const currentSorted = [...current].sort((a, b) => {
    const aId = a.id || `${a.source}-${a.target}`;
    const bId = b.id || `${b.source}-${b.target}`;
    return aId.localeCompare(bId);
  });

  const originalSorted = [...original].sort((a, b) => {
    const aId = a.id || `${a.source}-${a.target}`;
    const bId = b.id || `${b.source}-${b.target}`;
    return aId.localeCompare(bId);
  });

  return currentSorted.every((edge, index) => {
    const origEdge = originalSorted[index];
    if (!origEdge) return false;

    return (
      edge.source === origEdge.source &&
      edge.target === origEdge.target &&
      edge.sourceHandle === origEdge.sourceHandle &&
      edge.targetHandle === origEdge.targetHandle
    );
  });
};

const FlowBuilderConfig = () => {
  const classes = useStyles();
  const history = useHistory();
  const { id } = useParams();

  const storageItems = useNodeStorage();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [dataNode, setDataNode] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTypebot, setModalAddTypebot] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddDeepSeek, setModalAddDeepSeek] = useState(null); // Nuevo estado
  const [modalAddQuestion, setModalAddQuestion] = useState(null);
  const [availableVariables, setAvailableVariables] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialNodesLoaded, setInitialNodesLoaded] = useState(false);
  const [multimediaOpen, setMultimediaOpen] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [aiToolsOpen, setAiToolsOpen] = useState(false);

  // NUEVO: Estado para guardar la versión original
  const [originalState, setOriginalState] = useState({
    nodes: [],
    edges: []
  });

  const connectionLineStyle = { stroke: "#2b2b2b", strokeWidth: "4px" };

  const addNode = (type, data) => {
    const posY = nodes[nodes.length - 1].position.y;
    const posX = nodes[nodes.length - 1].position.x + (nodes[nodes.length - 1].width || 200) + 40;

    if (type === "start") {
      return setNodes((old) => {
        return [
          ...old.filter((item) => item.id !== "1"),
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: "Inicio del flujo" },
            type: "start",
          }
        ];
      });
    }
    if (type === "text") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message",
          },
        ];
      });
    }
    if (type === "interval") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval",
          },
        ];
      });
    }
    if (type === "condition") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              key: data.key,
              condition: data.condition,
              value: data.value,
            },
            type: "condition",
          },
        ];
      });
    }
    if (type === "request") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "request",
          },
        ];
      });
    }
    if (type === "menu") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption,
            },
            type: "menu",
          },
        ];
      });
    }
    if (type === "img") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img",
          },
        ];
      });
    }
    if (type === "audio") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio",
          },
        ];
      });
    }
    if (type === "randomizer") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer",
          },
        ];
      });
    }
    if (type === "video") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video",
          },
        ];
      });
    }
    if (type === "singleBlock") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock",
          },
        ];
      });
    }
    if (type === "ticket") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket",
          },
        ];
      });
    }
    if (type === "typebot") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "typebot",
          },
        ];
      });
    }
    if (type === "openai") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }
    if (type === "deepseek") { // Nuevo caso para DeepSeek
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "deepseek",
          },
        ];
      });
    }
    if (type === "question") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "question",
          },
        ];
      });
    }
  };

  const textAdd = (data) => {
    addNode("text", data);
  };

  const intervalAdd = (data) => {
    addNode("interval", data);
  };


  const menuAdd = (data) => {
    addNode("menu", data);
  };

  const imgAdd = (data) => {
    addNode("img", data);
  };

  const audioAdd = (data) => {
    addNode("audio", data);
  };

  const randomizerAdd = (data) => {
    addNode("randomizer", data);
  };

  const videoAdd = (data) => {
    addNode("video", data);
  };

  const singleBlockAdd = (data) => {
    addNode("singleBlock", data);
  };

  const ticketAdd = (data) => {
    addNode("ticket", data);
  };

  const typebotAdd = (data) => {
    addNode("typebot", data);
  };

  const openaiAdd = (data) => {
    addNode("openai", data);
  };

  const deepseekAdd = (data) => { // Nueva función para DeepSeek
    addNode("deepseek", data);
  };

  const questionAdd = (data) => {
    addNode("question", data);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // NUEVO: Función saveFlow actualizada
  const saveFlow = async () => {
    try {
      await api.post("/flowbuilder/flow", {
        idFlow: id,
        nodes: nodes,
        connections: edges,
      });

      // Actualizar estado original después de guardar
      setOriginalState({
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges))
      });

      setHasUnsavedChanges(false);
      toast.success("¡Flujo guardado con éxito!");
    } catch (err) {
      toastError(err);
    }
  };

  // NUEVO: Detección inteligente de cambios
  useEffect(() => {
    if (!originalState.nodes.length && !originalState.edges.length) return;

    const hasNodesChanged = !areNodeArraysEqual(nodes, originalState.nodes);
    const hasEdgesChanged = !areEdgeArraysEqual(edges, originalState.edges);

    setHasUnsavedChanges(hasNodesChanged || hasEdgesChanged);
  }, [nodes, edges, originalState]);

  const doubleClick = (event, node) => {
    setDataNode(node);
    if (node.type === "message") {
      setModalAddText("edit");
    }
    if (node.type === "interval") {
      setModalAddInterval("edit");
    }
    if (node.type === "menu") {
      setModalAddMenu("edit");
    }
    if (node.type === "img") {
      setModalAddImg("edit");
    }
    if (node.type === "audio") {
      setModalAddAudio("edit");
    }
    if (node.type === "randomizer") {
      setModalAddRandomizer("edit");
    }
    if (node.type === "singleBlock") {
      setModalAddSingleBlock("edit");
    }
    if (node.type === "ticket") {
      setModalAddTicket("edit");
    }
    if (node.type === "typebot") {
      setModalAddTypebot("edit");
    }
    if (node.type === "openai") {
      setModalAddOpenAI("edit");
    }
    if (node.type === "deepseek") { // Nuevo caso para editar DeepSeek
      setModalAddDeepSeek("edit");
    }
    if (node.type === "question") {
      setModalAddQuestion("edit");
    }
  };

  const clickNode = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        if (item.id === node.id) {
          return {
            ...item,
            style: { backgroundColor: "#0000FF", padding: 1, borderRadius: 8 },
          };
        }
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 },
        };
      })
    );
  };

  const clickEdge = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        return {
          ...item,
          style: { backgroundColor: "#13111C", padding: 0, borderRadius: 8 },
        };
      })
    );
  };

  const updateNode = (dataAlter) => {
    setNodes((old) =>
      old.map((itemNode) => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddOpenAI(null);
    setModalAddDeepSeek(null); // Cerrar modal de DeepSeek
    setModalAddTypebot(null);
  };

  const multimediaActions = [
    {
      icon: <Message sx={{ color: "#6865A5" }} />,
      name: "Texto",
      type: "text",
    },
    {
      icon: <Image sx={{ color: "#6865A5" }} />,
      name: "Imagen",
      type: "img",
    },
    {
      icon: <MicNone sx={{ color: "#6865A5" }} />,
      name: "Audio",
      type: "audio",
    },
    {
      icon: <Videocam sx={{ color: "#6865A5" }} />,
      name: "Video",
      type: "video",
    },
  ];

  const aiToolsActions = [
    {
      icon: (
        <Box
          component="img"
          sx={{ width: 24, height: 24, color: "#3aba38" }}
          src={typebotIcon}
          alt="icon"
        />
      ),
      name: "TypeBot",
      type: "typebot",
    },
    {
      icon: <SiOpenai sx={{ color: "#F7953B" }} />,
      name: "OpenAI",
      type: "openai",
    },
    {
      icon: <DeepSeekIcon sx={{ color: "#1E90FF" }} />, // Nuevo icono para DeepSeek
      name: "DeepSeek",
      type: "deepseek",
    },
  ];

  const mainActions = [
    {
      icon: <LibraryBooks sx={{ color: "#EC5858" }} />,
      name: "Contenido",
      type: "content",
    },
    {
      icon: <DynamicFeed sx={{ color: "#683AC8" }} />,
      name: "Menú",
      type: "menu",
    },
    {
      icon: <BallotIcon sx={{ color: "#F7953B" }} />,
      name: "Pregunta",
      type: "question",
    },
    {
      icon: <CallSplit sx={{ color: "#1FBADC" }} />,
      name: "Randomizador",
      type: "random",
    },
    {
      icon: <AccessTime sx={{ color: "#F7953B" }} />,
      name: "Intervalo",
      type: "ticket",
    },
    {
      icon: <ConfirmationNumber sx={{ color: "#F7953B" }} />,
      name: "Ticket",
      type: "ticket",
    },
  ];

  const handleMultimediaAction = (type) => {
    switch (type) {
      case "text":
        setModalAddText("create");
        break;
      case "img":
        setModalAddImg("create");
        break;
      case "audio":
        setModalAddAudio("create");
        break;
      case "video":
        setModalAddVideo("create");
        break;
      default:
    }
    setMultimediaOpen(false);
  };

  const handleAiToolsAction = (type) => {
    switch (type) {
      case "typebot":
        setModalAddTypebot("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "deepseek": // Nuevo caso para DeepSeek
        setModalAddDeepSeek("create");
        break;
      default:
    }
    setAiToolsOpen(false);
  };

  const clickActions = (type) => {
    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "question":
        setModalAddQuestion("create");
        break;
      default:
    }
  };

  // NUEVO: useEffect actualizado para cargar estado inicial
  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);
          if (data.flow.flow !== null) {
            const flowNodes = data.flow.flow.nodes || initialNodes;
            const flowEdges = data.flow.flow.connections || initialEdges;

            setNodes(flowNodes);
            setEdges(flowEdges);

            // Guardar estado original
            setOriginalState({
              nodes: JSON.parse(JSON.stringify(flowNodes)),
              edges: JSON.parse(JSON.stringify(flowEdges))
            });

            // ✅ EXTRAER VARIABLES DE TODOS LOS NODOS RELEVANTES
            const variables = extractVariablesFromNodes(flowNodes);
            setAvailableVariables(variables);

            localStorage.setItem("variables", JSON.stringify(variables));
          } else {
            // Si no hay flujo guardado, usar estado inicial
            setOriginalState({
              nodes: JSON.parse(JSON.stringify(initialNodes)),
              edges: JSON.parse(JSON.stringify(initialEdges))
            });
          }
          setLoading(false);
          setInitialNodesLoaded(true);
        } catch (err) {
          toastError(err);
          setInitialNodesLoaded(true);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  useEffect(() => {
    const variables = extractVariablesFromNodes(nodes);
    setAvailableVariables(variables);
  }, [nodes]);

  // ✅ AGREGAR ESTA FUNCIÓN PARA EXTRAER VARIABLES
  const extractVariablesFromNodes = (nodes) => {
    const variables = [];

    nodes.forEach(node => {
      // Variables de nodos "question"
      if (node.type === "question" && node.data?.typebotIntegration?.answerKey) {
        variables.push(node.data.typebotIntegration.answerKey);
      }

      // Variables de nodos "request" 
      if (node.type === "request" && node.data?.typebotIntegration?.saveResponseTo) {
        variables.push(node.data.typebotIntegration.saveResponseTo);
      }

      // Variables de nodos "deepseek" que guardan respuesta
      if (node.type === "deepseek" && node.data?.typebotIntegration?.saveResponseTo) {
        variables.push(node.data.typebotIntegration.saveResponseTo);
      }

      // Variables de nodos "openai" que guardan respuesta (si aplica)
      if (node.type === "openai" && node.data?.typebotIntegration?.saveResponseTo) {
        variables.push(node.data.typebotIntegration.saveResponseTo);
      }

      // También puedes agregar variables de condiciones si es necesario
      if (node.type === "condition" && node.data?.key) {
        // Si la condición usa una variable específica
        const conditionKey = node.data.key;
        if (conditionKey && !variables.includes(conditionKey)) {
          variables.push(conditionKey);
        }
      }
    });

    return [...new Set(variables)]; // Eliminar duplicados
  };

  // ✅ PROTECCIÓN CONTRA SALIDA SIN GUARDAR
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes((old) => old.filter((item) => item.id !== storageItems.node));
      setEdges((old) => {
        const newData = old.filter((item) => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          (item) => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        (item) => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map((node) => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY,
        },
        selected: false,
        style: { backgroundColor: "#555555", padding: 0, borderRadius: 8 },
      };
      setNodes((old) => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action]);

  return (
    <Stack sx={{ height: "100vh" }}>
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />
      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />
      <FlowBuilderDeepSeekModal // Nuevo modal para DeepSeek
        open={modalAddDeepSeek}
        onSave={deepseekAdd}
        data={dataNode}
        onUpdate={updateNode}
        onClose={() => setModalAddDeepSeek(null)}
      />
      <FlowBuilderTypebotModal
        open={modalAddTypebot}
        onSave={typebotAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTypebot}
      />
      <FlowBuilderAddQuestionModal
        open={modalAddQuestion}
        onSave={questionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddQuestion}
      />
      {!loading && (
        <Paper
          className={classes.mainPaper}
          variant="outlined"
          onScroll={handleScroll}
        >
          <Stack>
            {/* SpeedDial principal - posición izquierda */}
            <SpeedDial
              ariaLabel="SpeedDial main actions"
              sx={{
                position: "absolute",
                top: 16,
                left: 16,
                zIndex: 1200,
              }}
              icon={<SpeedDialIcon />}
              direction={"down"}
              open={mainMenuOpen}
              onClose={() => setMainMenuOpen(false)}
              onOpen={() => setMainMenuOpen(true)}
            >
              {mainActions.map((action) => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  tooltipOpen
                  tooltipPlacement={"right"}
                  onClick={() => clickActions(action.type)}
                />
              ))}
            </SpeedDial>

            {/* SpeedDial para Multimedia - posición central */}
            <SpeedDial
              ariaLabel="SpeedDial multimedia actions"
              sx={{
                position: "absolute",
                top: 16,
                left: 80,
                zIndex: 1199,
              }}
              icon={<Collections sx={{ color: "#ffffffff" }} />}
              direction={"down"}
              open={multimediaOpen}
              onClose={() => setMultimediaOpen(false)}
              onOpen={() => setMultimediaOpen(true)}
            >
              {multimediaActions.map((action) => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  tooltipOpen
                  tooltipPlacement={"right"}
                  onClick={() => handleMultimediaAction(action.type)}
                />
              ))}
            </SpeedDial>

            {/* SpeedDial para AI Tools - posición derecha */}
            <SpeedDial
              ariaLabel="SpeedDial AI tools actions"
              sx={{
                position: "absolute",
                top: 16,
                left: 144,
                zIndex: 1198,
              }}
              icon={<SmartToy sx={{ color: "#ffffffff" }} />}
              direction={"down"}
              open={aiToolsOpen}
              onClose={() => setAiToolsOpen(false)}
              onOpen={() => setAiToolsOpen(true)}
            >
              {aiToolsActions.map((action) => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  tooltipOpen
                  tooltipPlacement={"right"}
                  onClick={() => handleAiToolsAction(action.type)}
                />
              ))}
            </SpeedDial>
          </Stack>
          <Stack
            sx={{
              position: "absolute",
              justifyContent: "center",
              flexDirection: "row",
              width: "100%",
              top: 16, // ✅ POSICIÓN CORREGIDA
              zIndex: 1000,
              // Evita que el contenedor superior capture clics sobre los botones
              pointerEvents: "none",
            }}
          >
            {hasUnsavedChanges && (
              <Box
                sx={{
                  padding: "16px 24px",
                  backgroundColor: "#fff8e1",
                  color: "#e65100",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  borderRadius: "16px",
                  border: "1px solid #ffd54f",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  // permitir interacción solo en el banner
                  pointerEvents: "auto",
                  // dejar espacio a la derecha para botones (ajustar si es necesario)
                  maxWidth: "calc(100% - 220px)",
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    backgroundColor: "#ff9800",
                    marginRight: "5px",
                    borderRadius: "50%",
                  }}
                />
                Cambios sin guardar
              </Box>
            )}
          </Stack>
          <Stack direction={"row"} justifyContent={"end"}>
            <Button
              onClick={() => {
                if (hasUnsavedChanges) {
                  const confirmLeave = window.confirm(
                    '⚠️ Tienes cambios sin guardar. ¿Estás seguro de que quieres regresar? Los cambios se perderán.'
                  );
                  if (confirmLeave) {
                    history.push("/flowbuilders");
                  }
                } else {
                  history.push("/flowbuilders");
                }
              }}
              className={classes.outlinedButton}
            >
              REGRESAR
            </Button>
            <Button
              sx={{ textTransform: "none" }}
              variant="contained"
              color="primary"
              onClick={saveFlow}
            >
              GUARDAR
            </Button>
          </Stack>
          <Stack
            direction={"row"}
            style={{
              width: "100%",
              height: "90%",
              position: "relative",
              display: "flex",
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              deleteKeyCode={["Backspace", "Delete"]}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={doubleClick}
              onNodeClick={clickNode}
              onEdgeClick={clickEdge}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              connectionLineStyle={connectionLineStyle}
              style={{
                backgroundColor: "#faf8f8ff",
              }}
              edgeTypes={edgeTypes}
              variant={"cross"}
              defaultEdgeOptions={{
                style: { color: "#ff0000", strokeWidth: "6px" },
                animated: false,
              }}
            >
              <Controls />
              <Background variant="dots" gap={12} size={-1} />
            </ReactFlow>

            <Stack
              style={{
                backgroundColor: "#160404ff",
                height: "20px",
                width: "58px",
                position: "absolute",
                bottom: 0,
                right: 0,
                zIndex: 1111,
              }}
            />
          </Stack>
        </Paper>
      )}
      {loading && (
        <Stack justifyContent={"center"} alignItems={"center"} height={"70vh"}>
          <CircularProgress />
        </Stack>
      )}
    </Stack>
  );
};

export default FlowBuilderConfig;