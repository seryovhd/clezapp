/**
 * Componente EditMessageModal
 * 
 * Este modal permite editar un mensaje previamente enviado por el usuario.
 * 
 * Funcionalidades:
 * - Abre un `Dialog` con el contenido original del mensaje para editar.
 * - Permite modificar el texto del mensaje.
 * - Incluye un botón para seleccionar emojis usando `emoji-mart` y agregarlos al texto.
 * - Envía la edición del mensaje al backend mediante una petición `POST` a `/messages/edit/:id`.
 * - Usa estilos adaptativos según el modo claro/oscuro.
 * 
 * Props:
 * - `open`: booleano que controla la visibilidad del modal.
 * - `onClose`: función para cerrar el modal.
 * - `onSave`: función opcional que puede ejecutarse tras guardar.
 * - `message`: objeto con la información del mensaje que se desea editar.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  InputBase
} from "@material-ui/core";
import CloseIcon from '@material-ui/icons/Close';
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import whatsBackground from "../../assets/wa-background-light.webp";
import whatsBackgroundDark from "../../assets/wa-background-dark.webp";
import { makeStyles } from "@material-ui/core";
import MarkdownWrapper from "../MarkdownWrapper";
import MoodIcon from "@material-ui/icons/Mood";
import api from "../../services/api";

// 👇 emoji-mart
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

const useStyles = makeStyles((theme) => ({
  messagesList: {
    backgroundSize: "370px",
    backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
    display: "flex",
    justifyContent: "center",
    flexGrow: 1,
    padding: "20px",
    overflowY: "scroll",
    "@media (max-width: 600px)": {
      paddingBottom: "90px"
    },
    ...theme.scrollbarStyles,
    minHeight: "150px",
    minWidth: "500px"
  },
  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },
  messageRight: {
    fontSize: "13px",
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 510,
    height: "auto",
    display: "block",
    position: "relative",
    whiteSpace: "pre-wrap",
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0
  },
  inputmsg: {
    backgroundColor: theme.mode === 'light' ? '#FFF' : '#1c1c1c',
    display: "flex",
    width: "100%",
    margin: "10px 0px 10px 20px",
    borderRadius: "10px",
    position: "relative"
  },
  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999"
  },
  titleBackground: {
    color: '#ffff',
    backgroundColor: "#00796b",
    marginLeft: '3px'
  },
  emojiBox: {
    position: "absolute",
    bottom: 63,
    left: 0,
    zIndex: 99
  },
}));

const EditMessageModal = ({ open, onClose, onSave, message }) => {
  const classes = useStyles();
  const [editedMessage, setEditedMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiOptionsRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (open && message?.body) {
      setEditedMessage(message.body);
    }
  }, [open, message]);

  const handleSave = async () => {
    if (editedMessage.trim()) {
      try {
        const updatedMsg = {
          read: 1,
          fromMe: true,
          mediaUrl: "",
          body: editedMessage,
          quotedMsg: null,
        };
        await api.post(`/messages/edit/${message.id}`, updatedMsg);
        onClose(false);
      } catch (err) {
        console.error("Error al editar el mensaje:", err);
      }
    }
  };

  const handleEmojiSelect = (emoji) => {
    setEditedMessage((prev) => prev + emoji.native);
    setShowEmoji(false); // 👈 Cierra al seleccionar
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      aria-labelledby="edit-message-dialog"
      PaperProps={{
        style: {
          zIndex: 10
        },
      }}
      ref={modalRef}
    >
      <DialogTitle id="edit-message-dialog" className={classes.titleBackground}>
        <IconButton edge="start" color="inherit" onClick={() => onClose(false)} aria-label="close">
          <CloseIcon />
        </IconButton>
        Editar Mensaje
      </DialogTitle>

      <DialogContent style={{ padding: 0 }}>
        <Box>
          <Box className={classes.messagesList}>
            <Box
              component="div"
              className={classes.messageRight}
              style={{ fontStyle: "italic", backgroundColor: "#d9fdd3" }}
            >
              <Box className={classes.textContentItem}>
                <Box component="div" style={{ color: "#212B36" }}>
                  <MarkdownWrapper>{message?.body}</MarkdownWrapper>
                </Box>
              </Box>
            </Box>
          </Box>

          <Paper
            component="form"
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: "0px",
              backgroundColor: "#f0f2f5",
              position: "relative"
            }}
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Box className={classes.inputmsg}>
              <InputBase
                style={{ padding: "15px", flex: 1 }}
                multiline
                maxRows={6}
                placeholder="Editar mensaje"
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
              />

              <IconButton onClick={() => setShowEmoji((prev) => !prev)}>
                <MoodIcon />
              </IconButton>

              {showEmoji && (
                <Box className={classes.emojiBox} ref={emojiOptionsRef}>
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="light" />
                </Box>
              )}
            </Box>

            <IconButton color="primary" onClick={handleSave}>
              <CheckCircleIcon style={{ width: 35, height: 35, color: '#00A884' }} />
            </IconButton>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EditMessageModal;
