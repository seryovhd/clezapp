import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import MicRecorder from "mic-recorder-to-mp3";
import clsx from "clsx";
import { isNil } from "lodash";
import { Reply, ChevronLeft, ChevronRight, Message, TrendingUp, Edit as EditIcon, AttachFile as AttachFileIcon } from "@material-ui/icons";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";
import { green, grey, blue, pink, purple, orange } from "@material-ui/core/colors";
import IconButton from "@material-ui/core/IconButton";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import { FormControlLabel, Switch, ClickAwayListener } from "@material-ui/core";
import { isString, isEmpty, isObject, has } from "lodash";
import AddIcon from "@material-ui/icons/Add";
import ImageIcon from "@material-ui/icons/Image";
import DescriptionIcon from "@material-ui/icons/Description";
import VideocamIcon from "@material-ui/icons/Videocam";
import LocationOnIcon from "@material-ui/icons/LocationOn";
import MenuItem from "@material-ui/core/MenuItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import axios from "axios";

import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import { useHistory } from "react-router-dom";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import toastError from "../../errors/toastError";

import Compressor from 'compressorjs';
import LinearWithValueLabel from "./ProgressBarCustom";
import useQuickMessages from "../../hooks/useQuickMessages";
const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    backgroundColor: theme.palette.bordabox,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    flexShrink: 0,
  },
  newMessageBox: {
    backgroundColor: theme.palette.newmessagebox,
    width: "100%",
    padding: "7px",
    alignItems: "center",
    position: "relative",
  },
  messageInputWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: theme.palette.inputdigita,
    padding: "4px 10px",
    minWidth: 0,
  },
  messageInput: {
    flex: 1,
    width: "100%",
    minWidth: 0,
    border: "none",
    fontSize: "0.9rem",
    lineHeight: "1.5",
  },
  sendMessageIcons: {
    color: "grey",
  },
  ForwardMessageIcons: {
    color: grey[700],
    transform: 'scaleX(-1)'
  },
  uploadInput: {
    display: "none",
  },
  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.inputdigita,
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },
  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: "1px solid #e8e8e8",
  },
  attachmentMenu: {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: 0,
    width: "190px",
    backgroundColor: theme.palette.type === "dark" ? "#202c33" : "#ffffff",
    borderRadius: "12px",
    boxShadow: theme.palette.type === "dark"
      ? "0 8px 24px rgba(0, 0, 0, 0.6)"
      : "0 4px 20px rgba(0, 0, 0, 0.15)",
    border: theme.palette.type === "dark"
      ? "1px solid rgba(255, 255, 255, 0.1)"
      : "1px solid rgba(0, 0, 0, 0.08)",
    zIndex: 1200,
    padding: "6px 0",
    overflow: "hidden",
  },
  attachmentMenuItem: {
    padding: "8px 16px",
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.04)",
    },
    "& .MuiListItemText-primary": {
      fontSize: "0.88rem",
      fontWeight: 500,
      color: theme.palette.type === "dark" ? "#e9edef" : "#111b21",
    },
  },
  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },
  audioLoading: {
    color: green[500],
    opacity: "70%",
  },
  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },
  cancelAudioIcon: {
    color: "red",
  },
  sendAudioIcon: {
    color: "green",
  },
  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
  },
  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },
  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },
  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },
  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },
  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
  quickMessagesWrapper: {
    position: 'relative',
    width: '100%',
  },
  quickMessagesContainer: {
    display: 'flex',
    overflowX: 'auto',
    scrollBehavior: 'smooth',
    padding: '5px 30px',
    gap: '8px',
    position: 'relative',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    '-ms-overflow-style': 'none',
  },
  quickMessageButton: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.75rem',
    backgroundColor: '#FF5722',
    color: '#fff',
    fontWeight: 500,
    textTransform: 'none',
    border: 'none',
    '& .start-icon': {
      marginRight: '6px',
      fontSize: '14px',
    },
    '& .end-icon': {
      marginLeft: '6px',
      fontSize: '14px',
    },
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '4px',
    '&.left': {
      left: '5px',
    },
    '&.right': {
      right: '5px',
    },
  },
  floatingWrapper: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '10px',
    right: '10px',
    maxHeight: '340px',
    backgroundColor: theme.palette.type === 'dark' ? '#111b21' : '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    border: theme.palette.type === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.12)',
    zIndex: 1300,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: '$fadeIn 0.15s ease-out',
  },
  '@keyframes fadeIn': {
    from: {
      opacity: 0,
      transform: 'translateY(6px)',
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
  floatingHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px 6px 14px',
    borderBottom: theme.palette.type === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
  },
  floatingHeaderTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: theme.palette.type === 'dark' ? '#8696a0' : '#54656f',
    letterSpacing: '0.3px',
  },
  floatingList: {
    overflowY: 'auto',
    padding: '6px 8px',
    margin: 0,
    listStyle: 'none',
    maxHeight: '280px',
    ...theme.scrollbarStyles,
  },
  floatingItem: {
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    margin: '3px 0',
    transition: 'background-color 0.12s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    '&:hover': {
      backgroundColor: theme.palette.type === 'dark' ? '#182229' : '#f0f2f5',
    },
  },
  floatingItemSelected: {
    backgroundColor: theme.palette.type === 'dark' ? '#202c33 !important' : '#e9edef !important',
  },
  floatingItemShortcode: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: theme.palette.type === 'dark' ? '#e9edef' : '#111b21',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  floatingItemMessage: {
    fontSize: '0.82rem',
    color: theme.palette.type === 'dark' ? '#8696a0' : '#667781',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.35,
    whiteSpace: 'pre-wrap',
  },
  floatingItemMediaBadge: {
    fontSize: '11px',
    color: '#25d366',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  imageIcon: {
    color: blue[500],
  },
  documentIcon: {
    color: orange[500],
  },
  videoIcon: {
    color: pink[500],
  },
  locationIcon: {
    color: purple[500],
  },
  audioIcon: {
    color: green[500],
  },
  toolbarRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    width: "100%",
    [theme.breakpoints.down("xs")]: {
      justifyContent: "space-between",
      gap: 4
    }
  },

  inputRow: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    gap: 6,
    [theme.breakpoints.down("xs")]: {
      flexDirection: "row",
    }
  },

  switchLabel: {
    fontSize: "0.75rem",
    marginRight: 4
  },
  privateInput: {
    backgroundColor: "#fff8dc !important",
    border: "2px dashed #f5a623 !important",
    borderRadius: 8,
    padding: "8px",
    color: "#111b21 !important",
    "& input, & textarea, & .MuiInputBase-input": {
      color: "#111b21 !important",
      "-webkit-text-fill-color": "#111b21 !important",
      caretColor: "#111b21 !important",
    },
    "& input::placeholder, & textarea::placeholder, & .MuiInputBase-input::placeholder": {
      color: "#667781 !important",
      "-webkit-text-fill-color": "#667781 !important",
      opacity: "1 !important",
    },
  },
  attachedMediaWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 14px",
    backgroundColor: theme.palette.type === "dark" ? "#1e293b" : "#f1f5f9",
    borderTop: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
    borderBottom: theme.palette.type === "dark" ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
    width: "100%",
    boxSizing: "border-box",
  },
  attachedMediaContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    overflow: "hidden",
    flex: 1,
    minWidth: 0,
  },
  attachedMediaThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    objectFit: "cover",
    border: "1px solid rgba(0, 0, 0, 0.15)",
    flexShrink: 0,
  },
  attachedMediaIcon: {
    color: "#25d366",
    fontSize: 28,
    flexShrink: 0,
  },
  attachedMediaInfo: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  },
  attachedMediaName: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: theme.palette.type === "dark" ? "#e2e8f0" : "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  attachedMediaSize: {
    fontSize: "0.75rem",
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
  },
  attachedMediaClose: {
    color: theme.palette.type === "dark" ? "#94a3b8" : "#64748b",
    padding: 6,
    "&:hover": {
      color: "#ef4444",
    },
  }

}));

const EmojiOptions = (props) => {
  const theme = useTheme();
  const { disabled, showEmoji, setShowEmoji, handleAddEmoji } = props;
  const classes = useStyles();
  return (
    <>
      <IconButton
        aria-label="emojiPicker"
        component="span"
        disabled={disabled}
        onClick={(e) => setShowEmoji((prevState) => !prevState)}
      >
        <MoodIcon className={classes.sendMessageIcons} />
      </IconButton>
      {showEmoji ? (
        <div className={classes.emojiBox}>
          <Picker
            data={data}
            onEmojiSelect={handleAddEmoji}
            theme={theme.palette.type === "dark" ? "dark" : "light"}
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      ) : null}
    </>
  );
};

const SignSwitch = (props) => {
  const { width, setSignMessage, signMessage } = props;

  if (isWidthUp("md", width)) {
    return (
      <FormControlLabel
        style={{ marginRight: 7, color: "gray" }}
        label={i18n.t("messagesInput.signMessage")}
        labelPlacement="start"
        control={
          <Switch
            size="small"
            checked={signMessage}
            onChange={(e) => {
              setSignMessage(e.target.checked);
            }}
            name="showAllTickets"
            color="primary"
          />
        }
      />
    );
  }
  return null;
};

const FileInput = (props) => {
  const { handleChangeMedias, disableOption, setMedias } = props;
  const classes = useStyles();
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const handleOpenOptions = () => {
    setShowOptions(!showOptions);
  };

  const handleOptionClick = (type) => {
    setShowOptions(false);
    switch (type) {
      case 'image':
        fileInputRef.current.click();
        break;
      case 'audio':
        audioInputRef.current.click();
        break;
      case 'video':
        videoInputRef.current.click();
        break;
      case 'document':
        documentInputRef.current.click();
        break;
      case 'location':
        handleShareLocation();
        break;
      default:
        break;
    }
  };

  const handleShareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const locationUrl = `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
        props.setInputMessage(prev => `${prev}\nMi ubicación: ${locationUrl}`);
      }, (error) => {
        toastError("Error al obtener la ubicación: " + error.message);
      });
    } else {
      toastError("La geolocalización no es compatible con el navegador");
    }
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        <IconButton
          aria-label="upload"
          component="span"
          disabled={disableOption()}
          onClick={handleOpenOptions}
        >
          <AddIcon className={classes.sendMessageIcons} />
        </IconButton>

        {showOptions && (
          <ClickAwayListener onClickAway={() => setShowOptions(false)}>
            <Paper elevation={4} className={classes.attachmentMenu}>
              <MenuItem className={classes.attachmentMenuItem} onClick={() => handleOptionClick('image')}>
                <ListItemIcon style={{ minWidth: 36 }}>
                  <ImageIcon fontSize="small" className={classes.imageIcon} />
                </ListItemIcon>
                <ListItemText primary="Imagen" />
              </MenuItem>
              <MenuItem className={classes.attachmentMenuItem} onClick={() => handleOptionClick('document')}>
                <ListItemIcon style={{ minWidth: 36 }}>
                  <DescriptionIcon fontSize="small" className={classes.documentIcon} />
                </ListItemIcon>
                <ListItemText primary="Documento" />
              </MenuItem>
              <MenuItem className={classes.attachmentMenuItem} onClick={() => handleOptionClick('video')}>
                <ListItemIcon style={{ minWidth: 36 }}>
                  <VideocamIcon fontSize="small" className={classes.videoIcon} />
                </ListItemIcon>
                <ListItemText primary="Video" />
              </MenuItem>
              <MenuItem className={classes.attachmentMenuItem} onClick={() => handleOptionClick('location')}>
                <ListItemIcon style={{ minWidth: 36 }}>
                  <LocationOnIcon fontSize="small" className={classes.locationIcon} />
                </ListItemIcon>
                <ListItemText primary="Ubicación" />
              </MenuItem>
              <MenuItem className={classes.attachmentMenuItem} onClick={() => handleOptionClick('audio')}>
                <ListItemIcon style={{ minWidth: 36 }}>
                  <MicIcon fontSize="small" className={classes.audioIcon} />
                </ListItemIcon>
                <ListItemText primary="Audio" />
              </MenuItem>
            </Paper>
          </ClickAwayListener>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleChangeMedias(Array.from(e.target.files));
        }}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleChangeMedias(Array.from(e.target.files));
        }}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleChangeMedias(Array.from(e.target.files));
        }}
      />
      <input
        type="file"
        ref={documentInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) handleChangeMedias(Array.from(e.target.files));
        }}
      />
    </>
  );
};

const ActionButtons = (props) => {
  const {
    inputMessage,
    medias = [],
    loading,
    recording,
    ticketStatus,
    handleSendMessage,
    handleCancelAudio,
    handleUploadAudio,
    handleStartRecording,
    handleOpenModalForward,
    showSelectMessageCheckbox,
    is24HoursExceeded = false
  } = props;
  const classes = useStyles();

  // Mostrar siempre el botón de enviar, pero deshabilitado si no hay texto o si pasaron 24 horas
  if (recording) {
    return (
      <div className={classes.recorderWrapper}>
        <IconButton
          aria-label="cancelRecording"
          component="span"
          fontSize="large"
          disabled={loading}
          onClick={handleCancelAudio}
        >
          <HighlightOffIcon className={classes.cancelAudioIcon} />
        </IconButton>
        {loading ? (
          <div>
            <CircularProgress className={classes.audioLoading} />
          </div>
        ) : (
          <RecordingTimer />
        )}

        <IconButton
          aria-label="sendRecordedAudio"
          component="span"
          onClick={handleUploadAudio}
          disabled={loading || is24HoursExceeded}
          title={is24HoursExceeded ? "No puedes enviar mensajes: han pasado más de 24 horas desde el último mensaje del cliente" : ""}
        >
          <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
        </IconButton>
      </div>
    );
  } else {
    // Habilitado cuando: hay texto, hay selección de reenvío, o hay archivo adjunto en borrador
    const hasContent = (inputMessage && inputMessage.trim().length > 0) || showSelectMessageCheckbox || (medias && medias.length > 0);
    const isDisabled = loading || is24HoursExceeded || !hasContent || ticketStatus !== "open";
    
    let tooltipText = "";
    if (is24HoursExceeded) {
      tooltipText = "No puedes enviar mensajes: han pasado más de 24 horas desde el último mensaje del cliente";
    } else if (!hasContent) {
      tooltipText = "Escribe un mensaje o adjunta un archivo para enviar";
    } else if (ticketStatus !== "open") {
      tooltipText = "El ticket debe estar abierto para enviar mensajes";
    }
    
    return (
      <IconButton
        aria-label="sendMessage"
        component="span"
        onMouseDown={(e) => e.preventDefault()}
        onClick={showSelectMessageCheckbox ? handleOpenModalForward : handleSendMessage}
        disabled={isDisabled}
        title={tooltipText}
      >
        {showSelectMessageCheckbox ?
          <Reply className={classes.ForwardMessageIcons} /> : <SendIcon className={classes.sendMessageIcons} />}
      </IconButton>
    );
  }
};

const CustomInput = (props) => {
  const {
    loading,
    inputRef,
    ticketStatus,
    inputMessage,
    setInputMessage,
    handleSendMessage,
    handleInputPaste,
    disableOption,
    replyingMessage,
    sendPrivate,
    floatingOpen,
    onFloatingKeyDown
  } = props;
  const classes = useStyles();

  const handleKeyDown = (e) => {
    if (floatingOpen && onFloatingKeyDown) {
      const handled = onFloatingKeyDown(e);
      if (handled) return;
    }
  };

  const onKeyPress = (e) => {
    if (loading || e.shiftKey) return;
    else if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const onPaste = (e) => {
    if (ticketStatus === "open") {
      handleInputPaste(e);
    }
  };

  const renderPlaceholder = () => {
    if (sendPrivate) {
      return "Mensaje privado (solo visible para ti)";
    }
    if (ticketStatus === "open") {
      return i18n.t("messagesInput.placeholderOpen");
    }
    return i18n.t("messagesInput.placeholderClosed");
  };

  const setInputRef = (input) => {
    if (input) {
      input.focus();
      inputRef.current = input;
    }
  };

  return (
    <div className={classes.messageInputWrapper}>
      <InputBase
        inputRef={setInputRef}
        placeholder={renderPlaceholder()}
        multiline
        maxRows={5}
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onPaste={onPaste}
        onKeyDown={handleKeyDown}
        onKeyPress={onKeyPress}
        disabled={disableOption()}
        className={clsx(classes.messageInput, {
          [classes.privateInput]: sendPrivate
        })}
      />
    </div>
  );
};

const normalizeQuickText = (str) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const cleanQuickCode = (str) =>
  normalizeQuickText((str || "").replace(/^\/+/, ""));

const filterQuickMessagesHelper = (quickMessages, inputMessage) => {
  if (!inputMessage || !inputMessage.startsWith("/")) {
    return quickMessages || [];
  }

  const query = cleanQuickCode(inputMessage);
  if (!query) {
    return quickMessages || [];
  }

  const matches = [];
  for (const msg of quickMessages || []) {
    const code = cleanQuickCode(msg.shortcode);
    const body = normalizeQuickText(msg.message);

    const codeExact = code === query;
    const codeStarts = code.startsWith(query);
    const codeIncludes = code.includes(query);
    const bodyIncludes = body.includes(query);

    if (codeExact || codeStarts || codeIncludes || bodyIncludes) {
      let score = 5;
      if (codeExact) {
        score = 1; // Coincidencia exacta del acceso directo (ej. hola === hola)
      } else if (codeStarts) {
        score = 2; // El acceso empieza con el término buscado
      } else if (codeIncludes) {
        score = 3; // El acceso contiene el término buscado
      } else {
        // Coincidencia dentro del cuerpo del mensaje
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const isWord = new RegExp(`(^|[^a-zA-Z0-9])${escapedQuery}([^a-zA-Z0-9]|$)`, "i").test(body);
        score = isWord ? 4 : 5;
      }
      matches.push({ msg, score, code });
    }
  }

  // Si existe coincidencia EXACTA con el acceso directo, mostrar ÚNICAMENTE la coincidencia exacta
  const exactMatches = matches.filter((m) => m.score === 1);
  if (exactMatches.length > 0) {
    return exactMatches.map((m) => m.msg);
  }

  // Si no hay coincidencia exacta, mostrar por similitud ordenadas por relevancia
  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.code.length !== b.code.length) return a.code.length - b.code.length;
    return a.code.localeCompare(b.code);
  });

  return matches.map((m) => m.msg);
};

const QuickMessages = ({ quickMessages, handleQuickMessageClick, inputMessage }) => {
  const classes = useStyles();
  const containerRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const filteredQuickMessages = useMemo(() => {
    if (!inputMessage.startsWith('/')) return quickMessages;
    return filterQuickMessagesHelper(quickMessages, inputMessage);
  }, [inputMessage, quickMessages]);

  useEffect(() => {
    if (containerRef.current) {
      setMaxScroll(containerRef.current.scrollWidth - containerRef.current.clientWidth);
    }
  }, [filteredQuickMessages]);

  const handleScroll = (direction) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollAmount = 200;

    if (direction === 'left') {
      container.scrollLeft -= scrollAmount;
    } else {
      container.scrollLeft += scrollAmount;
    }

    setTimeout(() => {
      setScrollPosition(container.scrollLeft);
    }, 300);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
    setScrollPosition(containerRef.current.scrollLeft);
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
    setScrollPosition(containerRef.current.scrollLeft);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (filteredQuickMessages.length === 0) return null;

  return (
    <div className={classes.quickMessagesWrapper}>
      {scrollPosition > 0 && (
        <IconButton
          className={`${classes.navButton} left`}
          onClick={() => handleScroll('left')}
        >
          <ChevronLeft />
        </IconButton>
      )}

      <div
        className={classes.quickMessagesContainer}
        ref={containerRef}
        onScroll={(e) => setScrollPosition(e.target.scrollLeft)}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {filteredQuickMessages.map((message, index) => (
          <Button
            key={index}
            variant="contained"
            disableElevation
            className={classes.quickMessageButton}
            onClick={() => handleQuickMessageClick(message)}
          >
            <Message className="start-icon" />
            {(message.shortcode || "").replace(/^\//, "")}
            <TrendingUp className="end-icon" />
          </Button>
        ))}
      </div>

      {scrollPosition < maxScroll && (
        <IconButton
          className={`${classes.navButton} right`}
          onClick={() => handleScroll('right')}
        >
          <ChevronRight />
        </IconButton>
      )}
    </div>
  );
};

const QuickMessagesFloating = ({
  messages,
  selectedIndex,
  onSelect,
  classes
}) => {
  const history = useHistory();

  return (
    <div className={classes.floatingWrapper}>
      <div className={classes.floatingHeader}>
        <span className={classes.floatingHeaderTitle}>
          {i18n.t("quickMessages.title", "Respuestas rápidas")}
        </span>
        <Tooltip title="Administrar respuestas rápidas">
          <IconButton
            size="small"
            style={{ color: "#8696a0", padding: 4 }}
            onClick={() => history.push("/quick-messages")}
          >
            <EditIcon style={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </div>
      <div className={classes.floatingList}>
        {messages.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={item.id || index}
              id={`quick-floating-item-${index}`}
              className={clsx(classes.floatingItem, {
                [classes.floatingItemSelected]: isSelected
              })}
              onClick={() => onSelect(item)}
            >
              <div className={classes.floatingItemShortcode}>
                <span>{(item.shortcode || "").replace(/^\//, "")}</span>
                {item.mediaPath && (
                  <span className={classes.floatingItemMediaBadge} title="Contiene multimedia">
                    <AttachFileIcon style={{ fontSize: 13 }} />
                  </span>
                )}
              </div>
              <div className={classes.floatingItemMessage}>
                {item.message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MessageInputCustom = (props) => {
  const { ticketStatus, ticketId, is24HoursExceeded = false } = props;
  
  // Debug: Log cuando cambia is24HoursExceeded
  React.useEffect(() => {
    console.log("🔍 [MESSAGE INPUT] is24HoursExceeded cambió:", is24HoursExceeded);
  }, [is24HoursExceeded]);
  const classes = useStyles();
  const [percentLoading, setPercentLoading] = useState(0);
  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef();
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  const {
    selectedMessages,
    setForwardMessageModalOpen,
    showSelectMessageCheckbox } = useContext(ForwardMessageContext);

  const [quickMessages, setQuickMessages] = useState([]);
  const { list: listQuickMessages } = useQuickMessages();

  useEffect(() => {
    inputRef.current.focus();
  }, [replyingMessage]);
  //HUB INICIO
  const [channelType, setChannelType] = useState(null);
  useEffect(() => {
    const fetchChannelType = async () => {
      if (!ticketId || ticketId === "undefined" || typeof ticketId !== "number") {
        //console.log("BD TICKET.ID (INVALIDO):", ticketId);
        return;
      }
      /*       else{
              console.log("BD TICKET.ID:", ticketId); // Log para depuración
            } */

      try {
        const { data } = await api.get(`/tickets/${ticketId}`);
        //console.log("DATA TICKETS:", data);
        //console.log("TIPO CANAL (whatsapp?.type):", data.whatsapp?.type);
        setChannelType(data.whatsapp?.type);
      } catch (err) {
        //console.error("Error al obtener el tipo de canal:", err);
        toastError(err);
      }
    };
    fetchChannelType();
  }, [ticketId]);

  // HUB FIN
  useEffect(() => {
    inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);

  const socketManager = useContext(SocketContext);
  const [quickMessagesMode, setQuickMessagesMode] = useState("both");
  const [selectedQuickIndex, setSelectedQuickIndex] = useState(0);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await api.get("/settings");
        if (Array.isArray(data)) {
          const setting = data.find(s => s.key === "quickMessagesMode");
          if (setting) {
            setQuickMessagesMode(setting.value);
          }
        }
      } catch (err) {}
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    const companyId = user?.companyId || localStorage.getItem("companyId");
    if (!companyId || !socketManager) return;
    const socket = socketManager.getSocket(companyId);
    if (!socket) return;
    const onSettingUpdate = (data) => {
      if (data.action === "update" && data.setting?.key === "quickMessagesMode") {
        setQuickMessagesMode(data.setting.value);
      }
    };
    socket.on(`company-${companyId}-settings`, onSettingUpdate);
    return () => {
      socket.off(`company-${companyId}-settings`, onSettingUpdate);
    };
  }, [socketManager, user]);

  const filteredFloatingMessages = useMemo(() => {
    if (!inputMessage.startsWith("/")) return [];
    return filterQuickMessagesHelper(quickMessages, inputMessage);
  }, [inputMessage, quickMessages]);

  const isFloatingOpen =
    (quickMessagesMode === "floating" || quickMessagesMode === "both") &&
    inputMessage.startsWith("/") &&
    filteredFloatingMessages.length > 0;

  useEffect(() => {
    setSelectedQuickIndex(0);
  }, [filteredFloatingMessages]);

  useEffect(() => {
    if (isFloatingOpen) {
      const el = document.getElementById(`quick-floating-item-${selectedQuickIndex}`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedQuickIndex, isFloatingOpen]);

  const handleSelectQuickMessage = (message) => {
    if (!message) return;
    if (message.mediaPath) {
      handleQuickMessageClick(message);
    } else {
      setInputMessage(message.message || "");
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  };

  const handleFloatingKeyDown = (e) => {
    if (!isFloatingOpen) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedQuickIndex((prev) => (prev + 1) % filteredFloatingMessages.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedQuickIndex((prev) => (prev - 1 + filteredFloatingMessages.length) % filteredFloatingMessages.length);
      return true;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      handleSelectQuickMessage(filteredFloatingMessages[selectedQuickIndex]);
      return true;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSelectQuickMessage(filteredFloatingMessages[selectedQuickIndex]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setInputMessage("");
      return true;
    }
    return false;
  };

  useEffect(() => {
    async function fetchData() {
      const companyId = localStorage.getItem("companyId");
      const messages = await listQuickMessages({ companyId, userId: user.id });
      setQuickMessages(messages);
    }
    fetchData();
  }, []);

  const handleOpenModalForward = () => {
    if (selectedMessages.length === 0) {
      setForwardMessageModalOpen(false)
      toastError(i18n.t("messagesList.header.notMessage"));
      return;
    }
    setForwardMessageModalOpen(true);
  }

  const handleAddEmoji = (emoji) => {
    setInputMessage((prev) => prev + emoji.native);
    setShowEmoji(false);
  };


  const handleChangeMedias = (selectedMedias) => {
    setMedias(selectedMedias);
    console.log("TEST ARCHIVO: ", selectedMedias);
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
    setLoading(true);
    try {
      const extension = blob.type.split("/")[1];
      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body", message);
      formData.append("fromMe", true);
      //console.log(`ENVIO A BACK CON ARCHIVO:: ${ticketId} -- `, channelType ," -- ",formData);
      // PARCHE 1.3 - HUB

      if (["whatsapp_business", "baileys", "evolution", "whatsapp", "facebook_messenger"].includes(channelType)) {
        await api.post(`/messages/${ticketId}`, formData);
      } else {
        await api.post(`/hub-message/${ticketId}`, formData);
      }
      // PARCHE 1.3 - HUB FIN
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
  };

  const handleQuickMessageClick = async (message) => {
    if (channelType === null) {
      toastError("⚠️ WHATSAPPS.TYPE no encontrado");
      return;
    }
    if (message.mediaPath) {
      console.log("RESP.RAPIDA MESSAGE:: ", message);
      try {
        setLoading(true);
        const fileName = message.mediaPath.split("/").pop();
        const { data } = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/public/company${message.companyId}/quick/${fileName}`, {
          responseType: "blob",
        });

        // Crear objeto File para agregarlo a medias como borrador
        const extension = data.type ? (data.type.split("/")[1] || "dat") : "dat";
        const file = new File([data], fileName || `archivo.${extension}`, { type: data.type || "application/octet-stream" });
        setMedias([file]);

        // Cargar el texto en el input para que el usuario pueda editarlo
        setInputMessage(message.message || "");
        setLoading(false);

        // Enfocar el campo de texto y posicionar el cursor al final
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            if (typeof inputRef.current.setSelectionRange === "function") {
              const len = (message.message || "").length;
              inputRef.current.setSelectionRange(len, len);
            }
          }
        }, 80);
        return;
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    } else {
      const messageToSend = signMessage
        ? `*${user?.name}:*\n${message.message}`
        : message.message;

      try {
        const payload = {
          read: 1,
          fromMe: true,
          mediaUrl: "",
          body: messageToSend,
          quotedMsg: replyingMessage,
        };
        if (["whatsapp_business", "baileys", "evolution", "whatsapp", "facebook_messenger"].includes(channelType)) {
          await api.post(`/messages/${ticketId}`, payload);
        } else {
          await api.post(`/hub-message/${ticketId}`, {
            ...payload,
            companyId: user?.companyId, // por si hub lo requiere
          });
        }
        setInputMessage("");
      } catch (err) {
        toastError(err);
      }
    }
  };

  const handleUploadMedia = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!medias || medias.length === 0) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("fromMe", true);

    const captionText = signMessage
      ? `*${user?.name}:*\n${inputMessage.trim()}`
      : inputMessage.trim();

    // Procesamiento de archivos con compresión para imágenes
    for (const media of medias) {
      if (!media) continue;

      const isImage = media?.type?.split("/")[0] === "image";

      if (isImage) {
        try {
          const compressed = await new Promise((resolve, reject) => {
            new Compressor(media, {
              quality: 0.7,
              success: resolve,
              error: reject,
            });
          });
          formData.append("medias", compressed);
          formData.append("body", captionText || "");
        } catch (err) {
          console.error("Error al comprimir imagen:", err.message);
          formData.append("medias", media);
          formData.append("body", captionText || "");
        }
      } else {
        formData.append("medias", media);
        formData.append("body", captionText || "");
      }
    }

    // Envío del archivo al endpoint adecuado
    try {
      const endpoint =
        channelType && !["whatsapp", "baileys", "evolution", "whatsapp_business", "facebook_messenger"].includes(channelType.toLowerCase())
          ? `/hub-message/${ticketId}`
          : `/messages/${ticketId}`;

      await api.post(endpoint, formData, {
        onUploadProgress: (event) => {
          const progress = Math.round((event.loaded * 100) / event.total);
          setPercentLoading(progress);
        },
      });

      setLoading(false);
      setMedias([]);
      setInputMessage("");
      setPercentLoading(0);
      setReplyingMessage(null);
    } catch (err) {
      console.error("Hubo un problema al subir la imagen.", err);
      toastError(err);
      setLoading(false);
    }
  };


  const handleSendMessage = async () => {
    // Si hay archivo adjunto, se envía con el texto como pie de foto
    if (medias && medias.length > 0) {
      await handleUploadMedia();
      return;
    }

    if (inputMessage.trim() === "") return;

    // Si el mensaje es un comando que coincide exactamente con una respuesta rápida
    if (inputMessage.trim().startsWith("/")) {
      const queryCode = cleanQuickCode(inputMessage);
      const exactMsg = quickMessages.find(msg => cleanQuickCode(msg.shortcode) === queryCode);
      if (exactMsg) {
        await handleQuickMessageClick(exactMsg);
        return;
      }
    }

    const currentText = inputMessage.trim();
    const currentReplying = replyingMessage;
    const currentPrivate = sendPrivate;

    // ⚡ Optimistic UI: vaciar campo de texto inmediatamente (0ms) para respuesta ultra rápida
    setInputMessage("");
    setReplyingMessage(null);
    setShowEmoji(false);

    // Mantener siempre el foco activo en el input para que el teclado móvil no se oculte ni se desplace
    setTimeout(() => {
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
      }
    }, 10);

    //HUB INICIO
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${currentText}`
        : currentText,
      quotedMsg: currentReplying,
      companyId: user?.companyId,
      isPrivate: currentPrivate
    };

    try {
      if (channelType === null) {
        toastError("⚠️ WHATSAPPS.TYPE no encontrado");
        setInputMessage(currentText);
        setReplyingMessage(currentReplying);
        return;
      }
      if (["whatsapp_business", "baileys", "evolution", "whatsapp", "facebook_messenger"].includes(channelType)) {
        await api.post(`/messages/${ticketId}`, message);
      } else {
        await api.post(`/hub-message/${ticketId}`, message);
      }
    } catch (err) {
      // Si la petición falla, restaurar el texto para que el operador no lo pierda
      setInputMessage(currentText);
      setReplyingMessage(currentReplying);
      toastError(err);
    }
    // HUB FIN
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await Mp3Recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const filename = `audio-record-site-${new Date().getTime()}.mp3`;
      formData.append("medias", blob, filename);
      formData.append("body", "");
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setRecording(false);
    setLoading(false);
  };

  const handleCancelAudio = async () => {
    try {
      await Mp3Recorder.stop().getMp3();
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const disableOption = () => {
    const disabled = loading || recording || ticketStatus !== "open" || is24HoursExceeded;
    if (is24HoursExceeded) {
      console.log("🔍 [MESSAGE INPUT] Opciones deshabilitadas por límite de 24 horas");
    }
    return disabled;
  };
  const [sendPrivate, setSendPrivate] = useState(false);
  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={loading || ticketStatus !== "open"}
          onClick={() => setReplyingMessage(null)}
        >
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  const renderAttachedMedia = () => {
    const file = medias[0];
    if (!file) return null;
    const isImage = file.type?.startsWith("image/");
    let previewUrl = null;
    try {
      if (isImage && (file instanceof Blob || file instanceof File)) {
        previewUrl = URL.createObjectURL(file);
      }
    } catch (e) {
      previewUrl = null;
    }

    return (
      <div className={classes.attachedMediaWrapper}>
        <div className={classes.attachedMediaContainer}>
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              className={classes.attachedMediaThumb}
            />
          ) : (
            <AttachFileIcon className={classes.attachedMediaIcon} />
          )}
          <div className={classes.attachedMediaInfo}>
            <span className={classes.attachedMediaName} title={file.name}>
              {file.name}
            </span>
            {file.size ? (
              <span className={classes.attachedMediaSize}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            ) : null}
          </div>
          {loading && percentLoading > 0 && (
            <div style={{ marginLeft: "auto", marginRight: 8 }}>
              <LinearWithValueLabel progress={percentLoading} />
            </div>
          )}
        </div>
        <IconButton
          size="small"
          aria-label="cancel-upload"
          disabled={loading}
          onClick={() => {
            setMedias([]);
            setPercentLoading(0);
          }}
          className={classes.attachedMediaClose}
          title="Quitar archivo adjunto"
        >
          <CancelIcon style={{ fontSize: 22 }} />
        </IconButton>
      </div>
    );
  };

  return (
    <Paper square elevation={0} className={classes.mainWrapper}>
      {replyingMessage && renderReplyingMessage(replyingMessage)}

      {medias.length > 0 && renderAttachedMedia()}

      {/* CAROUSEL TRADICIONAL (En modo carousel siempre visible y filtrable con '/', en modo both visible solo si no se escribe '/') */}
      {(quickMessagesMode === "carousel" || (quickMessagesMode === "both" && !inputMessage.startsWith("/"))) &&
        quickMessages.length > 0 && (
          <QuickMessages
            quickMessages={quickMessages}
            handleQuickMessageClick={handleQuickMessageClick}
            inputMessage={inputMessage}
          />
      )}

      <div className={classes.newMessageBox}>
        {/* POPUP FLOTANTE FORMATO WHATSAPP WEB */}
        {isFloatingOpen && (
          <QuickMessagesFloating
            messages={filteredFloatingMessages}
            selectedIndex={selectedQuickIndex}
            onSelect={handleSelectQuickMessage}
            classes={classes}
          />
        )}

        <div className={classes.toolbarRow}>
          <EmojiOptions
            disabled={disableOption()}
            handleAddEmoji={handleAddEmoji}
            showEmoji={showEmoji}
            setShowEmoji={setShowEmoji}
          />

          <FileInput
            disableOption={disableOption}
            handleChangeMedias={handleChangeMedias}
            setMedias={setMedias}
            setInputMessage={setInputMessage}
          />

          <FormControlLabel
            label="Firma"
            labelPlacement="end"
            className={classes.switchLabel}
            control={
              <Switch
                size="small"
                checked={signMessage}
                onChange={(e) => setSignMessage(e.target.checked)}
                color="primary"
              />
            }
          />

          <FormControlLabel
            label="Privado"
            labelPlacement="end"
            className={classes.switchLabel}
            style={{ color: sendPrivate ? "#ff9800" : "gray" }}
            control={
              <Switch
                size="small"
                checked={sendPrivate}
                onChange={(e) => setSendPrivate(e.target.checked)}
                color="secondary"
              />
            }
          />
        </div>

        <div className={classes.inputRow}>
          <CustomInput
            loading={loading}
            inputRef={inputRef}
            ticketStatus={ticketStatus}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            handleSendMessage={handleSendMessage}
            handleInputPaste={handleInputPaste}
            disableOption={disableOption}
            replyingMessage={replyingMessage}
            sendPrivate={sendPrivate}
            floatingOpen={isFloatingOpen}
            onFloatingKeyDown={handleFloatingKeyDown}
          />

          <ActionButtons
            inputMessage={inputMessage}
            medias={medias}
            loading={loading}
            recording={recording}
            ticketStatus={ticketStatus}
            handleSendMessage={handleSendMessage}
            handleCancelAudio={handleCancelAudio}
            handleUploadAudio={handleUploadAudio}
            handleStartRecording={handleStartRecording}
            handleOpenModalForward={handleOpenModalForward}
            showSelectMessageCheckbox={showSelectMessageCheckbox}
            is24HoursExceeded={is24HoursExceeded}
          />
        </div>
      </div>

    </Paper>
  );
};

export default withWidth()(MessageInputCustom);