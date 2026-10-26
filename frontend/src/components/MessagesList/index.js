/**
 * Componente MessagesList
 * 
 * Este componente renderiza la lista completa de mensajes de un ticket de atención (chat) en tiempo real.
 * Incluye las siguientes funcionalidades principales:
 * 
 * - Obtiene y pagina mensajes desde la API REST (`/messages/:ticketId`)
 * - Se suscribe a un socket para recibir actualizaciones en tiempo real de mensajes (nuevos o editados)
 * - Permite renderizar:
 *    • Mensajes enviados y recibidos (con diferentes estilos visuales)
 *    • Mensajes reenviados, editados o eliminados
 *    • Citas de mensajes anteriores ("quotedMsg")
 *    • Archivos multimedia (audio, video, imagen, ubicación, vCard, archivos)
 *    • Timestamps diarios y separadores visuales por autor
 *    • Reacciones con emojis (mostradas en burbujas)
 *    • Acciones sobre el mensaje (editar, borrar, responder, reenviar)
 * - Detecta si el contacto está escribiendo o grabando audio (mostrando animaciones)
 * 
 * Utiliza contextos compartidos para gestionar:
 * - Socket de comunicación (`SocketContext`)
 * - Mensaje en respuesta (`ReplyMessageContext`)
 * - Modo selección múltiple de mensajes (`ForwardMessageContext`)
 */
import React, { useState, useEffect, useReducer, useRef, useContext } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";
import { green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  Badge,
  Fade,
} from "@material-ui/core";
import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  Reply,
} from "@material-ui/icons";
import AudioModal from "../AudioModal";
import MarkdownWrapper from "../MarkdownWrapper";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background-light.webp";
import LocationPreview from "../LocationPreview";
import whatsBackgroundDark from "../../assets/wa-background-dark.webp";
import VCardPreview from "../VCardPreview";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import SelectMessageCheckbox from "./SelectMessageCheckbox";
import { Lock } from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    flexGrow: 1,
    width: "100%",
    minWidth: 0,
    minHeight: 0,
  },
  messagesList: {
    backgroundColor: (theme.palette?.type || theme.mode) === 'dark' ? "#0b141a" : "#efeae2",
    backgroundImage: (theme.palette?.type || theme.mode) === 'dark' ? `url(${whatsBackgroundDark})` : `url(${whatsBackground})`,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "10px 20px 10px 20px",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  circleLoadingContainer: {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 20,
    pointerEvents: "none",
  },
  circleLoading: {
    color: green[500],
    opacity: 0.85,
  },
  relationContainer: {
    marginTop: -10,
    paddingTop: 5,
    fontSize: "12px",
    color: "#666",
    display: "block",
    textAlign: "left",
  },
  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: (theme.palette?.type || theme.mode) === 'dark' ? "#202c33" : "#ffffff",
    color: (theme.palette?.type || theme.mode) === 'dark' ? "#e9edef" : "#111b21",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 0.5px rgba(11,20,26,.13)",
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  quotedContainerLeft: {
    margin: "0 0 5px 0",
    overflow: "hidden",
    backgroundColor: (theme.palette?.type || theme.mode) === 'dark' ? "#182229" : "#f5f6f6",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },
  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#00a884",
  },
  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: (theme.palette?.type || theme.mode) === 'dark' ? "#005c4b" : "#d9fdd3",
    color: (theme.palette?.type || theme.mode) === 'dark' ? "#e9edef" : "#111b21",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 0.5px rgba(11,20,26,.13)",
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  quotedContainerRight: {
    margin: "0 0 5px 0",
    overflow: "hidden",
    backgroundColor: (theme.palette?.type || theme.mode) === 'dark' ? "#025144" : "#d1f4cc",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },
  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#25d366",
  },
  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },
  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  textContentItemEdited: {
    overflowWrap: "break-word",
    padding: "3px 120px 6px 6px",
    borderLeft: "3px solid #6bcbef",
    "& a": {
      color: (theme.palette?.type || theme.mode) === 'dark' ? "#21c063" : "#027eb5",
      textDecoration: "underline",
      "&:hover": {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#25d366" : "#015b82",
      },
    },
  },
  textContentItemDeleted: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },
  forwardMessage: {
    fontSize: 12,
    fontStyle: "italic",
    position: "absolute",
    top: 0,
    left: 5,
    color: "#999",
    display: "flex",
    alignItems: "center"
  },
  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: (theme.palette?.type || theme.mode) === 'dark' ? "#8696a0" : "#667781",
  },
  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "auto",
    padding: "2px 10px",
    backgroundColor: (theme.palette?.type || theme.mode) === 'dark' ? "#182229" : "#ffffff",
    margin: "10px",
    borderRadius: "8px",
    boxShadow: "0 1px 0.5px rgba(11,20,26,.13)",
  },
  dailyTimestampText: {
    color: (theme.palette?.type || theme.mode) === 'dark' ? "#8696a0" : "#54656f",
    padding: 4,
    fontSize: "12px",
    fontWeight: 500,
    alignSelf: "center",
    marginLeft: "0px",
  },
  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },
  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
    color: "#d32f2f"
  },
  ackDoneAllIcon: {
    color: "#53bdeb",
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    backgroundColor: theme.mode === 'light' ? '#2DDD7F' : '#1c1c1c',
    color: theme.mode === 'light' ? '#2DDD7F' : '#FFF',
  },
  // PARCHE MENSAJE PRIVADO
  messageRightPrivate: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: "#F0E68C", // color personalizado para mensajes privados
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3"
  },
  messagePrivateIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#f5a623", // naranja dorado
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  messageDeleted: {
    fontWeight: "bold !important",
    fontStyle: "italic",
    color: "#b03a2e",
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.88rem",
    marginBottom: 2
  },
  wave: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: "6px 12px",
    minHeight: 28,
  },
  dot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: "#d32f2f",
    animation: "$wave 1.3s linear infinite",
    "&:nth-child(2)": {
      animationDelay: "-1.1s",
    },
    "&:nth-child(3)": {
      animationDelay: "-0.9s",
    },
  },
  "@keyframes wave": {
    "0%, 60%, 100%": {
      transform: "initial",
    },
    "30%": {
      transform: "translateY(-6px)",
    },
  },
  wavebarsContainer: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    padding: "6px 12px",
  },
  wavebars: {
    width: 3,
    height: 14,
    backgroundColor: "#d32f2f",
    borderRadius: 2,
    animation: "$wavebar 1s ease-in-out infinite",
  },
  wavebar1: { animationDelay: "0.1s" },
  wavebar2: { animationDelay: "0.2s" },
  wavebar3: { animationDelay: "0.3s" },
  wavebar4: { animationDelay: "0.4s" },
  wavebar5: { animationDelay: "0.5s" },
  "@keyframes wavebar": {
    "0%, 100%": { height: 6 },
    "50%": { height: 18 },
  },
}));

// Cache LRU en memoria para mensajes de tickets recientes (render instantáneo 0ms al alternar chats)
export const recentMessagesCache = new Map();
const MAX_CACHED_TICKETS = 40;

export const setTicketMessagesCache = (id, messages, hasMore = false, secondaryId = null) => {
  if (!id && !secondaryId) return;
  const key1 = id != null ? String(id) : null;
  const key2 = secondaryId != null ? String(secondaryId) : null;

  if (key1) {
    if (recentMessagesCache.has(key1)) {
      recentMessagesCache.delete(key1);
    } else if (recentMessagesCache.size >= MAX_CACHED_TICKETS) {
      const oldestKey = recentMessagesCache.keys().next().value;
      recentMessagesCache.delete(oldestKey);
    }
    recentMessagesCache.set(key1, { messages, hasMore });
  }

  if (key2 && key2 !== key1) {
    if (recentMessagesCache.has(key2)) {
      recentMessagesCache.delete(key2);
    } else if (recentMessagesCache.size >= MAX_CACHED_TICKETS) {
      const oldestKey = recentMessagesCache.keys().next().value;
      recentMessagesCache.delete(oldestKey);
    }
    recentMessagesCache.set(key2, { messages, hasMore });
  }
};

export const getTicketMessagesCache = (id) => {
  if (!id) return null;
  return recentMessagesCache.get(String(id)) || null;
};

// Ordenamiento cronológico estricto por fecha de creación (createdAt ASC)
const sortMessages = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || "").toString().localeCompare((b.id || "").toString());
  });
};

const reducer = (state, action) => {
  if (action.type === "HYDRATE_CACHED") {
    return sortMessages(action.payload);
  }

  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload || [];
    let combined;

    if (action.isPageOne) {
      // Página 1: Reemplaza con los mensajes más recientes del backend,
      // preservando únicamente mensajes optimistas pendientes de confirmación
      const existingIds = new Set(messages.map((m) => m.id));
      const optimistic = state.filter(
        (m) =>
          !existingIds.has(m.id) &&
          (typeof m.id === "string" || m.id < 0 || m.status === "pending")
      );
      combined = [...messages, ...optimistic];
    } else {
      // Paginación hacia arriba (mensajes más antiguos)
      const existingIds = new Set(state.map((m) => m.id));
      const newOlderMessages = messages.filter((m) => !existingIds.has(m.id));
      combined = [...newOlderMessages, ...state];
    }

    return sortMessages(combined);
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    if (!newMessage) return state;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    let updated;
    if (messageIndex !== -1) {
      updated = [...state];
      updated[messageIndex] = newMessage;
    } else {
      updated = [...state, newMessage];
    }

    return sortMessages(updated);
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    if (!messageToUpdate) return state;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      const prevMessage = state[messageIndex];
      const updated = [...state];
      updated[messageIndex] = {
        ...prevMessage,
        ...messageToUpdate,
        quotedMsg: messageToUpdate.quotedMsg || prevMessage.quotedMsg,
      };
      return sortMessages(updated);
    }

    return state;
  }

  if (action.type === "RESET") {
    return [];
  }
};

const isMediaFilename = (body, mediaUrl) => {
  if (!body || typeof body !== "string") return false;
  const trimmed = body.trim();
  if (!trimmed || trimmed === "-") return true;
  if (mediaUrl) {
    const filenameFromUrl = mediaUrl.split("/").pop()?.split("?")[0];
    if (filenameFromUrl && (trimmed === filenameFromUrl || trimmed === decodeURIComponent(filenameFromUrl))) {
      return true;
    }
  }
  // Detectar nombres de archivo con extensión (ej: MAX5S0.png, imagen.jpg, etc.)
  return /^[^\n\r]+\.(png|jpe?g|webp|gif|bmp|svg|mp4|mov|avi|mkv|ogg|mp3|wav|m4a|opus|bin|pdf|docx?|xlsx?|pptx?|txt|zip|rar)$/i.test(trimmed);
};

const isStickerMessage = (message) => {
  if (!message) return false;
  return (
    message.mediaType === "sticker" ||
    message.detectedMediaType === "sticker" ||
    (message.mediaType === "image" && (
      message.body?.toLowerCase() === "sticker" ||
      (typeof message.mediaUrl === "string" && message.mediaUrl.toLowerCase().includes(".webp"))
    ))
  );
};

const MessagesList = ({ ticket, ticketId, isGroup }) => {
  const classes = useStyles();
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesContainerRef = useRef(null);
  const lastMessageRef = useRef(null);
  const [contactPresence, setContactPresence] = useState("available");
  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const socketManager = useContext(SocketContext);
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const { showSelectMessageCheckbox } = useContext(ForwardMessageContext);

  const isInitialLoad = useRef(true);

  const scrollToBottomInstant = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      try {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth"
        });
      } catch (e) {
        scrollToBottomInstant();
      }
    } else {
      scrollToBottomInstant();
    }
  };

  const ensureScrollToBottom = () => {
    scrollToBottomInstant();
    requestAnimationFrame(() => {
      scrollToBottomInstant();
    });
    setTimeout(scrollToBottomInstant, 50);
    setTimeout(scrollToBottomInstant, 150);
    setTimeout(scrollToBottomInstant, 300);
    setTimeout(scrollToBottomInstant, 600);
  };

  useEffect(() => {
    if (isInitialLoad.current && messagesList.length > 0) {
      ensureScrollToBottom();
      const timer = setTimeout(() => {
        ensureScrollToBottom();
        isInitialLoad.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [messagesList]);

  useEffect(() => {
    isInitialLoad.current = true;
    setPageNumber(1);
    currentTicketId.current = ticketId;

    if (ticketId) {
      const cached =
        getTicketMessagesCache(ticketId) ||
        (ticket?.id && getTicketMessagesCache(ticket.id)) ||
        (ticket?.uuid && getTicketMessagesCache(ticket.uuid));

      if (cached && cached.messages && cached.messages.length > 0) {
        dispatch({ type: "HYDRATE_CACHED", payload: cached.messages });
        setHasMore(cached.hasMore);
        ensureScrollToBottom();
      } else {
        dispatch({ type: "RESET" });
      }
    } else {
      dispatch({ type: "RESET" });
    }
  }, [ticketId]);

  useEffect(() => {
    const hasCache = Boolean(
      ticketId && (
        recentMessagesCache.has(String(ticketId)) ||
        (ticket?.id && recentMessagesCache.has(String(ticket.id))) ||
        (ticket?.uuid && recentMessagesCache.has(String(ticket.uuid)))
      )
    );
    if (!hasCache || pageNumber > 1) {
      setLoading(true);
    }
    let isMounted = true;
    const abortController = new AbortController();

    const fetchMessages = async () => {
      if (ticketId === undefined) return;
      try {
        const params = { pageNumber };
        if (pageNumber > 1 && messagesList.length > 0) {
          const oldest = messagesList[0];
          if (oldest?.id) {
            params.beforeId = oldest.id;
          }
          if (oldest?.createdAt) {
            params.beforeCreatedAt = oldest.createdAt;
          }
        }

        const { data } = await api.get("/messages/" + ticketId, {
          params,
          signal: abortController.signal,
        });

        const isSameTarget =
          currentTicketId.current === ticketId ||
          (ticket?.id && String(ticket.id) === String(ticketId)) ||
          (ticket?.uuid && String(ticket.uuid) === String(ticketId));

        if (isMounted && isSameTarget) {
          const container = messagesContainerRef.current;
          const previousScrollHeight = container ? container.scrollHeight : 0;
          const previousScrollTop = container ? container.scrollTop : 0;

          dispatch({
            type: "LOAD_MESSAGES",
            payload: data.messages,
            isPageOne: pageNumber === 1,
          });
          setHasMore(data.hasMore);
          setLoading(false);

          if (pageNumber === 1) {
            setTicketMessagesCache(
              ticketId,
              sortMessages(data.messages),
              data.hasMore,
              ticket?.id || ticket?.uuid
            );
            ensureScrollToBottom();
          } else {
            // Mantener la posición exacta de lectura al cargar páginas anteriores hacia arriba
            requestAnimationFrame(() => {
              if (container) {
                const heightDifference = container.scrollHeight - previousScrollHeight;
                container.scrollTop = previousScrollTop + heightDifference;
              }
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setLoading(false);
          isInitialLoad.current = false;
          if (!api.isCancel?.(err) && err?.name !== "CanceledError" && err?.name !== "AbortError") {
            toastError(err);
          }
        }
      }
    };

    fetchMessages();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [pageNumber, ticketId]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const onReady = () => {
      if (ticket?.id) {
        socket.emit("joinChatBox", `${ticket.id}`);
      }
    };

    const onAppMessage = (data) => {
      const isTargetTicket =
        data?.message && (
          data.message.ticketId === ticket?.id ||
          String(data.message.ticketId) === String(ticket?.id) ||
          String(data.message.ticketId) === String(currentTicketId.current) ||
          (ticket?.uuid && String(data.message.ticketId) === String(ticket.uuid))
        );

      if (data.action === "create" && isTargetTicket) {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        const cacheKey = ticket?.id ? String(ticket.id) : String(currentTicketId.current);
        const cached = recentMessagesCache.get(cacheKey) || (ticket?.uuid && recentMessagesCache.get(String(ticket.uuid)));
        if (cached) {
          const exists = cached.messages.some((m) => m.id === data.message.id);
          if (!exists) {
            setTicketMessagesCache(
              cacheKey,
              sortMessages([...cached.messages, data.message]),
              cached.hasMore,
              ticket?.uuid
            );
          }
        }
        scrollToBottom();
      }

      if (data.action === "update" && isTargetTicket) {
        if (data.message.isEdited) {
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              ...data.message,
              body: data.message.body || "Mensaje editado"
            }
          });
        } else {
          dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
        }
      }
    };

    socket.on("ready", onReady);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    if (ticket?.id && socket.connected) {
      socket.emit("joinChatBox", `${ticket.id}`);
    }

    return () => {
      socket.off("ready", onReady);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
  }, [ticketId, ticket, socketManager]);

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const handleScroll = (e) => {
    if (isInitialLoad.current) return;
    if (!hasMore || loading) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 1;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const hanldeReplyMessage = (e, message) => {
    setAnchorEl(null);
    setReplyingMessage(message);
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const checkMessageMedia = (message) => {
    if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    } else

      if (message.mediaType === "contactMessage") {
        let array = message.body.split("\n");
        let obj = [];
        let contact = "";
        for (let index = 0; index < array.length; index++) {
          const v = array[index];
          let values = v.split(":");
          for (let ind = 0; ind < values.length; ind++) {
            if (values[ind].indexOf("+") !== -1) {
              obj.push({ number: values[ind] });
            }
            if (values[ind].indexOf("FN") !== -1) {
              contact = values[ind + 1];
            }
          }
        }
        return <VCardPreview contact={contact} numbers={obj[0].number} />
      } else if (isStickerMessage(message)) {
        return <ModalImageCors imageUrl={message.mediaUrl} isSticker={true} />;
      } else if (message.mediaType === "image") {
        return <ModalImageCors imageUrl={message.mediaUrl} />;
      } else if (message.mediaType === "audio") {
        return <AudioModal url={message.mediaUrl} />;
      } else if (message.mediaType === "video") {
        const isGif = Boolean(
          message.body?.toLowerCase() === "gif" ||
          message.mediaUrl?.toLowerCase().endsWith(".gif") ||
          (typeof message.dataJson === "string" && message.dataJson.includes('"gifPlayback":true'))
        );
        return <ModalImageCors imageUrl={message.mediaUrl} mediaType="video" isGif={isGif} />;
      } else {
        return (
          <>
            <div className={classes.downloadMedia}>
              <Button
                startIcon={<GetApp />}
                variant="outlined"
                target="_blank"
                href={message.mediaUrl}
              >
                Download
              </Button>
            </div>
            <Divider />
          </>
        );
      }
  };

  const renderMessageAck = (message) => {
    if (message.isPrivate) return null;
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 4 || message.ack === 5) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} style={{ color: '#0377FC' }} />;
    }
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index < messagesList.length - 1) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
  };

  const renderNumberTicket = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageTicket = message.ticketId;
      let connectionName = message.ticket?.whatsapp?.name;
      let previousMessageTicket = messagesList[index - 1].ticketId;

      if (messageTicket !== previousMessageTicket) {
        return (
          <center>
            <div className={classes.ticketNunberClosed}>
              Conversación cerrada: {format(parseISO(messagesList[index - 1].createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>

            <div className={classes.ticketNunberOpen}>
              Conversación iniciada: {format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>
          </center>
        );
      }
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}
          {message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName} style={{ color: "#25d366" }}>
              Usted
            </span>
          )}

          {message.quotedMsg.mediaType === "audio" && (
            <div className={classes.downloadMedia}>
              <audio controls>
                <source src={message.quotedMsg.mediaUrl} type="audio/ogg" />
              </audio>
            </div>
          )}
          {message.quotedMsg.mediaType === "video" && message.quotedMsg.mediaUrl && (
            <div style={{ maxWidth: 180, maxHeight: 130, borderRadius: 6, overflow: "hidden", marginBottom: 4 }}>
              <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} mediaType="video" />
            </div>
          )}
          {message.quotedMsg.mediaType === "application" && (
            <div className={classes.downloadMedia}>
              <Button
                startIcon={<GetApp />}
                variant="outlined"
                href={message.quotedMsg.mediaUrl}
                target="_blank"
                sx={(theme) => ({
                  borderColor: theme.palette.mode === 'light' ? '#2DDD7F' : '#FFF',
                  color: theme.palette.mode === 'light' ? '#2DDD7F' : '#FFF',
                  backgroundColor: theme.palette.mode === 'light' ? '#2DDD7F10' : '#1c1c1c',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'light' ? '#2DDD7F20' : '#333',
                    borderColor: theme.palette.mode === 'light' ? '#2DDD7F' : '#FFF',
                    color: theme.palette.mode === 'light' ? '#2DDD7F' : '#FFF',
                  }
                })}
              >
                Download
              </Button>
            </div>
          )}

          {(message.quotedMsg.mediaType === "image" || message.quotedMsg.mediaType === "sticker") && message.quotedMsg.mediaUrl && (
            <div style={{ maxWidth: 90, maxHeight: 90, overflow: 'hidden', borderRadius: 4, marginBottom: 4 }}>
              <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} isSticker={isStickerMessage(message.quotedMsg)} />
            </div>
          )}

          {message.quotedMsg.body && (
            ((message.quotedMsg.mediaType === "image" && message.quotedMsg.body === "sticker") || message.quotedMsg.mediaType === "sticker" || isMediaFilename(message.quotedMsg.body, message.quotedMsg.mediaUrl)) ? null : (
              <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                {message.quotedMsg.body}
              </span>
            )
          )}
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (message.isPrivate && message.isDeleted && message.fromMe) return null;
        if (message.mediaType === "call_log") {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageCenter}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17">
                    <path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path>
                  </svg> <span>Llamada de voz/vídeo perdida a las {format(parseISO(message.createdAt), "HH:mm")}</span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              {renderNumberTicket(message, index)}
              <div style={{ alignItems: "flex-end", display: "inline-flex", marginBottom: "6px", position: "relative" }}>
                <div style={{ margin: "0 8px 0 0", width: 28, height: 28 }}>
                  {message.contact?.profilePicUrl ? (
                    <img
                      style={{ borderRadius: "50%", height: "28px", width: "28px", objectFit: "cover" }}
                      src={message.contact.profilePicUrl}
                      alt="avatar"
                      onError={(e) => {
                        // Si falla la carga de imagen, ocultamos la imagen y mostramos el ícono
                        e.target.onerror = null;
                        e.target.style.display = "none";
                        const parent = e.target.parentNode;
                        if (parent) {
                          const iconContainer = document.createElement("div");
                          iconContainer.style.width = "28px";
                          iconContainer.style.height = "28px";
                          iconContainer.style.borderRadius = "50%";
                          iconContainer.style.backgroundColor = "#ccc";
                          iconContainer.style.display = "flex";
                          iconContainer.style.alignItems = "center";
                          iconContainer.style.justifyContent = "center";

                          const icon = document.createElement("div");
                          icon.innerHTML = (message.contact?.name || "C")[0]?.toUpperCase() || "C";
                          icon.style.color = "#555";

                          iconContainer.appendChild(icon);
                          parent.appendChild(iconContainer);
                        }
                      }}
                    />
                  ) : (
                    // Si no hay imagen definida, mostramos el ícono directamente
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: "#ccc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {(message.contact?.name || "C")[0]?.toUpperCase() || "C"}
                    </div>
                  )}
                </div>
                <div
                  className={classes.messageLeft}
                  style={isStickerMessage(message) ? { backgroundColor: "transparent", boxShadow: "none", padding: 0 } : undefined}
                  title={message.queueId && message.queue?.name}
                  onDoubleClick={(e) => hanldeReplyMessage(e, message)}
                >
                  {showSelectMessageCheckbox && (
                    <SelectMessageCheckbox
                      // showSelectMessageCheckbox={showSelectMessageCheckbox}
                      message={message}
                    // selectedMessagesList={selectedMessagesList}
                    // setSelectedMessagesList={setSelectedMessagesList}
                    />
                  )}
                  <IconButton
                    variant="contained"
                    size="small"
                    id="messageActionsButton"
                    disabled={message.isDeleted}
                    className={classes.messageActionsButton}
                    onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                  >
                    <ExpandMore />
                  </IconButton>
                  {message.isForwarded && (
                    <div>
                      <span className={classes.forwardMessage}
                      ><Reply style={{ color: "grey", transform: 'scaleX(-1)' }} /> Reenviado
                      </span>
                      <br />
                    </div>
                  )}
                  {isGroup && (
                    <span className={classes.messageContactName}>
                      {message.contact?.name}
                    </span>
                  )}

                  {/* aviso de mensagem apagado pelo contato */}
                  {message.isDeleted && (
                    <div>
                      <span className={classes.messageDeleted}>
                        Este mensaje fue eliminado por el contacto&nbsp;
                        <Block
                          color="error"
                          fontSize="small"
                          className={classes.deletedIcon}
                        />
                      </span>
                    </div>
                  )}


                  {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "vcard" || message.mediaType === "contactMessage"
                    //|| message.mediaType === "multi_vcard" 
                  ) && checkMessageMedia(message)}
                  <div className={classes.textContentItem}>
                    {message.quotedMsg && renderQuotedMessage(message)}
                    {message.mediaType !== "reactionMessage" && !isStickerMessage(message) && message.body && !isMediaFilename(message.body, message.mediaUrl) && (
                      <MarkdownWrapper>
                        {message.mediaType === "locationMessage" || message.mediaType === "contactMessage"
                          ? null
                          : message.body}
                      </MarkdownWrapper>
                    )}
                    {message.mediaType === "reactionMessage" && message.body && (
                      <>
                        <span style={{ marginLeft: "0px", display: 'flex', alignItems: 'center' }}>
                          <MarkdownWrapper>
                            {"_*" + (message.fromMe ? 'Usted' : (message?.contact?.name ?? 'Contacto')) + "*_ reaccionó... "}
                          </MarkdownWrapper>
                          <Badge
                            className={classes.badge}
                            overlap="circular"
                            anchorOrigin={{
                              vertical: 'bottom',
                              horizontal: 'right',
                            }}
                            badgeContent={
                              <span style={{ fontSize: "1.2em", marginTop: "0", marginLeft: "5px" }}>
                                {message.body}
                              </span>
                            }
                          />
                        </span>
                      </>
                    )}

                    <span className={classes.timestamp}>
                      {message.isEdited ? "Editada " + format(parseISO(message.createdAt), "HH:mm") : format(parseISO(message.createdAt), "HH:mm")}
                    </span>

                    {/* Reacciones para mensajes recibidos */}
                    {message.reactions?.length > 0 && (
                      <div style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 4,
                        flexWrap: "wrap",
                        alignItems: "center",
                        fontSize: 16,
                        padding: "2px 4px",
                        borderRadius: 6,
                        background: "#f1f1f1",
                        width: "fit-content"
                      }}>
                        {Object.entries(
                          message.reactions.reduce((acc, reaction) => {
                            acc[reaction.type] = (acc[reaction.type] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <span key={emoji}>
                            {emoji} <small style={{ fontSize: 12 }}>x{count}</small>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={message.isPrivate ? classes.messageRightPrivate : classes.messageRight}
                style={isStickerMessage(message) ? { backgroundColor: "transparent", boxShadow: "none", padding: 0 } : undefined}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {message.isPrivate && <div className={classes.messagePrivateIndicator} />}

                {message.isPrivate && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#fff3cd",
                    border: "1px solid #ffeeba",
                    color: "#856404",
                    padding: "2px 6px",
                    borderRadius: 6,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    marginBottom: 6,
                    width: "fit-content"
                  }}>
                    <Lock style={{ fontSize: 14, marginRight: 4 }} />
                    PRIVADO
                  </div>
                )}

                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    message={message}
                  />
                )}
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}>
                      <Reply style={{ color: "grey", transform: 'scaleX(-1)' }} /> Reenviado
                    </span>
                    <br />
                  </div>
                )}
                {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "vcard" || message.mediaType === "contactMessage"
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {message.isDeleted ? (
                    <div>
                      <span className={classes.messageDeleted}>
                        Este mensaje fue eliminado por el contacto&nbsp;
                        <Block
                          color="error"
                          fontSize="small"
                          className={classes.deletedIcon}
                        />
                      </span>
                    </div>
                  ) : (
                    <>
                      {message.quotedMsg && renderQuotedMessage(message)}

                      {/* Contenido del mensaje normal */}
                      {message.mediaType !== "reactionMessage" && !isStickerMessage(message) && message.body && !isMediaFilename(message.body, message.mediaUrl) && (
                        <MarkdownWrapper>{message.body}</MarkdownWrapper>
                      )}

                      {/* Reacción a un mensaje citado */}
                      {message.quotedMsg && message.mediaType === "reactionMessage" && message.body && (
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <MarkdownWrapper>
                            {"_*" + (message.fromMe ? 'Usted' : (message?.contact?.name ?? 'Contacto')) + "*_ reaccionó... "}
                          </MarkdownWrapper>
                          <Badge
                            className={classes.badge}
                            overlap="circular"
                            anchorOrigin={{
                              vertical: 'bottom',
                              horizontal: 'right',
                            }}
                            badgeContent={
                              <span style={{ fontSize: "1.2em", marginLeft: "5px" }}>
                                {message.body}
                              </span>
                            }
                          />
                        </span>
                      )}
                    </>
                  )}

                  {/* Timestamp y ACK solo si no es eliminado */}
                  <span className={classes.timestamp}>
                    {message.isEdited
                      ? "Editada " + format(parseISO(message.createdAt), "HH:mm")
                      : format(parseISO(message.createdAt), "HH:mm")}
                    {!message.isDeleted && renderMessageAck(message)}
                  </span>

                  {/* Reacciones en burbuja si no está eliminado */}
                  {!message.isDeleted && message.reactions?.length > 0 && (
                    <div style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 4,
                      flexWrap: "wrap",
                      alignItems: "center",
                      fontSize: 16,
                      padding: "2px 4px",
                      borderRadius: 6,
                      background: "#f1f1f1",
                      width: "fit-content"
                    }}>
                      {Object.entries(
                        message.reactions.reduce((acc, reaction) => {
                          acc[reaction.type] = (acc[reaction.type] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([emoji, count]) => (
                        <span key={emoji}>
                          {emoji} <small style={{ fontSize: 12 }}>x{count}</small>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>¡Saluda a tu nuevo contacto!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <div
        ref={messagesContainerRef}
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {loading && pageNumber > 1 && (
          <div style={{ textAlign: "center", padding: "10px 0", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "0.85rem" }}>
            <CircularProgress size={16} style={{ color: "#008069" }} />
            <span>Cargando mensajes anteriores...</span>
          </div>
        )}
        {messagesList.length > 0 ? renderMessages() : []}
        <div ref={lastMessageRef} style={{ float: "left", clear: "both", height: 1 }} />
        {contactPresence === "composing" && (
          <div className={classes.messageLeft}>
            <div className={classes.wave}>
              <span className={classes.dot}></span>
              <span className={classes.dot}></span>
              <span className={classes.dot}></span>
            </div>
          </div>
        )}
        {contactPresence === "recording" && (
          <div className={classes.messageLeft}>
            <div className={classes.wavebarsContainer}>
              <div className={clsx(classes.wavebars, classes.wavebar1)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar2)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar3)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar4)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar5)}></div>
            </div>
          </div>
        )}
      </div>
      <Fade in={loading && pageNumber === 1} timeout={{ enter: 250, exit: 250 }}>
        <div className={classes.circleLoadingContainer}>
          <CircularProgress className={classes.circleLoading} size={32} />
        </div>
      </Fade>
    </div>
  );
};

export default React.memo(MessagesList);