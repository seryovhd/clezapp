import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";
import Compressor from "compressorjs";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  AddCircle,
  Delete,
  Image,
  Description,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Message,
  MicNone,
  Videocam,
} from "@mui/icons-material";
import { capitalize } from "../../utils/capitalize";
import { Box, Divider } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const FlowBuilderSingleBlockModal = ({
  open,
  onSave,
  onUpdate,
  data,
  close,
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [rule, setRule] = useState();

  const [medias, setMedias] = useState([]);

  const [textDig, setTextDig] = useState();

  const [elements, setElements] = useState([]);

  const [elementsSeq, setElementsSeq] = useState([]);

  const [elementsSeqEdit, setElementsSeqEdit] = useState([]);

  const [elementsEdit, setElementsEdit] = useState([]);

  const [numberMessages, setNumberMessages] = useState(0);

  const [numberMessagesLast, setNumberMessagesLast] = useState(0);

  const [numberInterval, setNumberInterval] = useState(0);

  const [numberIntervalLast, setNumberIntervalLast] = useState(0);

  const [numberAudio, setNumberAudio] = useState(0);

  const [numberAudioLast, setNumberAudioLast] = useState(0);

  const [numberVideo, setNumberVideo] = useState(0);

  const [numberVideoLast, setNumberVideoLast] = useState(0);

  const [numberImg, setNumberImg] = useState(0);

  const [numberImgLast, setNumberImgLast] = useState(0);

  const [loading, setLoading] = useState(false);

  const [previewImg, setPreviewImg] = useState([]);

  const [previewAudios, setPreviewAudios] = useState([]);

  const [previewVideos, setPreviewVideos] = useState([]);

  const [arrayOption, setArrayOption] = useState([]);

  const [variables, setVariables] = useState([]);
  const [numberImgUrl, setNumberImgUrl] = useState(0);
  const [numberImgUrlLast, setNumberImgUrlLast] = useState(0);
  const [numberDocument, setNumberDocument] = useState(0);
  const [numberDocumentLast, setNumberDocumentLast] = useState(0);
  const [numberDocumentUrl, setNumberDocumentUrl] = useState(0);
  const [numberDocumentUrlLast, setNumberDocumentUrlLast] = useState(0);
  const [previewDocuments, setPreviewDocuments] = useState([]);
  const [labels, setLabels] = useState({
    title: "Agregar contenido al flujo",
    btn: "Agregar",
  });

  const handleElements = (newNameFiles) => {
    let elementsSequence = [];

    const newArrMessage = elementsSeq.filter((item) => item.includes("message"));
    const newArrInterval = elementsSeq.filter((item) => item.includes("interval"));
    const newArrImg = elementsSeq.filter((item) => item.includes("img"));
    const newArrAudio = elementsSeq.filter((item) => item.includes("audio"));
    const newArrVideo = elementsSeq.filter((item) => item.includes("video"));
    const newArrImgUrl = elementsSeq.filter((item) => item.includes("imgUrl"));
    const newArrDocument = elementsSeq.filter((item) => item.includes("document"));
    const newArrDocumentUrl = elementsSeq.filter((item) => item.includes("documentUrl"));

    // ✅ TODOS LOS DOCUMENTOS (SUBIR ARCHIVO)
    for (let i = 0; i < numberDocument; i++) {
      const button = document.querySelector(`.btnDocument${newArrDocument[i].replace('document', '')}`);
      const documentUrl = button?.getAttribute('data-url');
      const fileName = button?.getAttribute('data-filename');

      if (elementsSeqEdit.includes(newArrDocument[i])) {
        const itemSelectedEdit = elementsEdit.filter(
          (item) => item.number === newArrDocument[i]
        )[0];
        elementsSequence.push({
          type: "document", // ✅ MANTENER COMO "document" PARA ARCHIVOS LOCALES
          value: itemSelectedEdit.value,
          original: itemSelectedEdit.original,
          caption: itemSelectedEdit.caption || "",
          number: itemSelectedEdit.number,
        });
      } else if (documentUrl && fileName) {
        // Usar la URL del documento subido a tu servidor
        elementsSequence.push({
          type: "document", // ✅ MANTENER COMO "document" PARA ARCHIVOS LOCALES
          value: fileName, // Guardar solo el nombre del archivo
          original: fileName,
          caption: "", // Caption por defecto vacío
          number: newArrDocument[i],
        });
      } else {
        toast.error(`Documento ${newArrDocument[i]} no se subió correctamente`);
        setLoading(false);
        throw "";
      }
    }

    // ✅ TODOS LOS DOCUMENTOS CON URL/VARIABLES
    for (let i = 0; i < numberDocumentUrl; i++) {
      const value = document
        .querySelector(`.${newArrDocumentUrl[i]}`)
        .querySelector(".MuiInputBase-input").value;

      if (!value) {
        toast.error("¡URL de documento vacía!");
        setLoading(false);
        throw "";
      }

      elementsSequence.push({
        type: "documentUrl", // ✅ MANTENER COMO "documentUrl" PARA URLs EXTERNAS
        value: value,
        fileName: value.split('/').pop() || "documento.pdf",
        caption: "", // Caption por defecto vacío
        number: newArrDocumentUrl[i],
      });
    }
    // ✅ TODOS LOS MENSAJES
    for (let i = 0; i < numberMessages; i++) {
      const value = document
        .querySelector(`.${newArrMessage[i]}`)
        .querySelector(".MuiInputBase-input").value;
      if (!value) {
        toast.error("¡Campos de mensaje vacíos!");
        setLoading(false);
        throw "";
      }
      elementsSequence.push({
        type: "message",
        value: value,
        number: newArrMessage[i],
      });
    }

    // ✅ TODOS LOS INTERVALOS
    for (let i = 0; i < numberInterval; i++) {
      const value = document
        .querySelector(`.${newArrInterval[i]}`)
        .querySelector(".MuiInputBase-input").value;
      if (parseInt(value) === 0 || parseInt(value) > 120) {
        toast.error("¡El intervalo no puede ser 0 ni mayor a 120!");
        setLoading(false);
        throw "";
      }
      elementsSequence.push({
        type: "interval",
        value: value,
        number: newArrInterval[i],
      });
    }

    // ✅ TODAS LAS IMÁGENES CON URL/VARIABLES
    for (let i = 0; i < numberImgUrl; i++) {
      const value = document
        .querySelector(`.${newArrImgUrl[i]}`)
        .querySelector(".MuiInputBase-input").value;

      if (!value) {
        toast.error("¡URL de imagen vacía!");
        setLoading(false);
        throw "";
      }

      elementsSequence.push({
        type: "imgUrl",
        value: value,
        number: newArrImgUrl[i],
      });
    }

    // ✅ TODAS LAS IMÁGENES (SUBIR ARCHIVO)
    for (let i = 0; i < numberImg; i++) {
      const onlyImg =
        newNameFiles !== null &&
        newNameFiles.filter(
          (file) =>
            file.includes("png") ||
            file.includes("jpg") ||
            file.includes("jpeg")
        );
      const onlyImgNameOriginal = medias.filter(
        (file) =>
          file.name.includes("png") ||
          file.name.includes("jpg") ||
          file.name.includes("jpeg")
      );

      if (elementsSeqEdit.includes(newArrImg[i])) {
        const itemSelectedEdit = elementsEdit.filter(
          (item) => item.number === newArrImg[i]
        )[0];
        elementsSequence.push({
          type: "img",
          value: itemSelectedEdit.value,
          original: itemSelectedEdit.original,
          number: itemSelectedEdit.number,
        });
      } else {
        let indexElem = 0;
        if (elementsSeqEdit.filter((item) => item.includes("img")).length > 0) {
          indexElem =
            elementsSeqEdit.filter((item) => item.includes("img")).length - i;
        } else {
          indexElem = i;
        }
        elementsSequence.push({
          type: "img",
          value: onlyImg[indexElem],
          original: onlyImgNameOriginal[indexElem].name,
          number: newArrImg[i],
        });
      }
    }

    // ✅ TODOS LOS AUDIOS
    for (let i = 0; i < numberAudio; i++) {
      const onlyAudio =
        newNameFiles !== null &&
        newNameFiles.filter(
          (file) =>
            file.includes("mp3") ||
            file.includes("ogg") ||
            file.includes("mpeg") ||
            file.includes("opus")
        );
      const onlyAudioNameOriginal = medias.filter(
        (file) =>
          file.name.includes("mp3") ||
          file.name.includes("ogg") ||
          file.name.includes("mpeg") ||
          file.name.includes("opus")
      );

      if (elementsSeqEdit.includes(newArrAudio[i])) {
        const itemSelectedEdit = elementsEdit.filter(
          (item) => item.number === newArrAudio[i]
        )[0];
        elementsSequence.push({
          type: "audio",
          value: itemSelectedEdit.value,
          original: itemSelectedEdit.original,
          number: itemSelectedEdit.number,
          record: document
            .querySelector(`.check${newArrAudio[i]}`)
            .querySelector(".PrivateSwitchBase-input").checked,
        });
      } else {
        let indexElem = 0;
        if (
          elementsSeqEdit.filter((item) => item.includes("audio")).length > 0
        ) {
          indexElem =
            elementsSeqEdit.filter((item) => item.includes("audio")).length - i;
        } else {
          indexElem = i;
        }
        elementsSequence.push({
          type: "audio",
          value: onlyAudio[indexElem],
          original: onlyAudioNameOriginal[indexElem].name,
          number: newArrAudio[i],
          record: document
            .querySelector(`.check${newArrAudio[i]}`)
            .querySelector(".PrivateSwitchBase-input").checked,
        });
      }
    }

    // ✅ TODOS LOS VIDEOS
    for (let i = 0; i < numberVideo; i++) {
      const onlyVideo =
        newNameFiles !== null &&
        newNameFiles.filter(
          (file) => file.includes("mp4") || file.includes("avi")
        );
      const onlyVideoNameOriginal = medias.filter(
        (file) => file.name.includes("mp4") || file.name.includes("avi")
      );

      if (elementsSeqEdit.includes(newArrVideo[i])) {
        const itemSelectedEdit = elementsEdit.filter(
          (item) => item.number === newArrVideo[i]
        )[0];
        elementsSequence.push({
          type: "video",
          value: itemSelectedEdit.value,
          original: itemSelectedEdit.original,
          number: itemSelectedEdit.number,
        });
      } else {
        let indexElem = 0;
        if (
          elementsSeqEdit.filter((item) => item.includes("video")).length > 0
        ) {
          indexElem =
            elementsSeqEdit.filter((item) => item.includes("video")).length - i;
        } else {
          indexElem = i;
        }
        elementsSequence.push({
          type: "video",
          value: onlyVideo[indexElem],
          original: onlyVideoNameOriginal[indexElem].name,
          number: newArrVideo[i],
        });
      }
    }

    console.log("✅ Elementos finales a guardar:", elementsSequence);
    return elementsSequence;
  };

  const deleteElementsTypeOne = (id, type) => {
    if (type === "imgUrl") {
      setNumberImgUrl((old) => old - 1);
      setElementsSeq((old) => old.filter((item) => item !== `imgUrl${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `imgUrl${id}`));
      document.querySelector(`.stackImgUrl${id}`).remove();
    }
    if (type === "message") {
      setNumberMessages((old) => old - 1);
      setElementsSeq((old) => old.filter((item) => item !== `message${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `message${id}`));
      document.querySelector(`.stackMessage${id}`).remove();
    }
    if (type === "interval") {
      setNumberInterval((old) => old - 1);
      setElementsSeq((old) => old.filter((item) => item !== `interval${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `interval${id}`));
      document.querySelector(`.stackInterval${id}`).remove();
    }
    if (type === "img") {
      setNumberImg((old) => old - 1);
      setPreviewImg((old) => {
        setMedias((oldMedia) => {
          try {
            return oldMedia.filter(
              (mediaItem) =>
                mediaItem.name !==
                old.filter((item) => item.number === id)[0].name
            );
          } catch (e) {
            return oldMedia;
          }
        });
        return old.filter((item) => item.number !== id);
      });
      setElementsSeq((old) => old.filter((item) => item !== `img${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `img${id}`));
      document.querySelector(`.stackImg${id}`).remove();
    }
    if (type === "audio") {
      setNumberAudio((old) => old - 1);
      setPreviewAudios((old) => {
        setMedias((oldMedia) => {
          try {
            return oldMedia.filter(
              (mediaItem) =>
                mediaItem.name !==
                old.filter((item) => item.number === id)[0].name
            );
          } catch (e) {
            return oldMedia;
          }
        });
        return old.filter((item) => item.number !== id);
      });
      setElementsSeq((old) => old.filter((item) => item !== `audio${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `audio${id}`));
      document.querySelector(`.stackAudio${id}`).remove();
    }
    if (type === "video") {
      setNumberVideo((old) => old - 1);
      setPreviewVideos((old) => {
        setMedias((oldMedia) => {
          try {
            return oldMedia.filter(
              (mediaItem) =>
                mediaItem.name !==
                old.filter((item) => item.number === id)[0].name
            );
          } catch (e) {
            return oldMedia;
          }
        });
        return old.filter((item) => item.number !== id);
      });
      setElementsSeq((old) => old.filter((item) => item !== `video${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `video${id}`));
      document.querySelector(`.stackVideo${id}`).remove();
    }
    // ✅ AGREGAR CASOS PARA DOCUMENTOS
    if (type === "document") {
      setNumberDocument((old) => old - 1);
      setPreviewDocuments((old) => {
        setMedias((oldMedia) => {
          try {
            return oldMedia.filter(
              (mediaItem) =>
                mediaItem.name !==
                old.filter((item) => item.number === id)[0].name
            );
          } catch (e) {
            return oldMedia;
          }
        });
        return old.filter((item) => item.number !== id);
      });
      setElementsSeq((old) => old.filter((item) => item !== `document${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `document${id}`));
      document.querySelector(`.stackDocument${id}`).remove();
    }
    if (type === "documentUrl") {
      setNumberDocumentUrl((old) => old - 1);
      setElementsSeq((old) => old.filter((item) => item !== `documentUrl${id}`));
      setElementsSeqEdit((old) => old.filter((item) => item !== `documentUrl${id}`));
      document.querySelector(`.stackDocumentUrl${id}`).remove();
    }
  };

  const moveElementDown = (id) => {
    setElementsSeq((old) => {
      const array = old;
      const index = array.indexOf(id);
      moveItemParaFrente(index);
      console.log("id", id);
      if (index !== -1 && index < array.length - 1) {
        // Verifica si el elemento fue encontrado en el array y no está en la última posición
        const nuevoArray = [...array]; // Crea una copia del array original
        const elementoMovido = nuevoArray.splice(index, 1)[0];
        nuevoArray.splice(index + 1, 0, elementoMovido);
        return nuevoArray;
      }
      return array;
    });
  };

  const moveElementUp = (id) => {
    setElementsSeq((old) => {
      const array = old;
      const index = array.indexOf(id);
      moveItemParaTras(index);

      if (index !== -1 && index > 0) {
        // Verifica si el elemento fue encontrado en el array y no está en la primera posición
        const nuevoArray = [...array]; // Crea una copia del array original
        const elementoMovido = nuevoArray.splice(index, 1)[0];
        nuevoArray.splice(index - 1, 0, elementoMovido);
        return nuevoArray;
      }
      return array;
    });
  };

  function moveItemParaFrente(posicion) {
    setElements((old) => {
      const array = old;

      if (posicion >= 0 && posicion < array.length - 1) {
        const nuevoArray = [...array]; // Crea una copia del array original
        const elementoMovido = nuevoArray.splice(posicion, 1)[0];
        nuevoArray.splice(posicion + 1, 0, elementoMovido);
        return nuevoArray;
      }

      return array; // Retorna el array original si el movimiento no es posible
    });
  }

  function moveItemParaTras(posicion) {
    setElements((old) => {
      const array = old;
      if (posicion > 0 && posicion < array.length) {
        const nuevoArray = [...array]; // Crea una copia del array original
        const elementoMovido = nuevoArray.splice(posicion, 1)[0];
        nuevoArray.splice(posicion - 1, 0, elementoMovido);
        return nuevoArray;
      }

      return array; // Retorna el array original si el movimiento no es posible
    });
  }

  const handleChangeMediasImg = (e, number) => {
    if (!e.target.files) return;

    if (e.target.files[0].size > 2000000) {
      toast.error("¡El archivo es muy grande! Máximo 2MB");
      return;
    }

    const imgBlob = URL.createObjectURL(e.target.files[0]);
    setPreviewImg((old) => [
      ...old,
      {
        number: number,
        url: imgBlob,
        name: e.target.files[0].name,
      },
    ]);
    const selectedMedias = Array.from(e.target.files);
    setMedias((old) => [...old, selectedMedias[0]]);

    document.querySelector(`.img${number}`).src = imgBlob;
    document.querySelector(`.btnImg${number}`).remove();
  };

  const handleChangeAudios = (e, number) => {
    if (!e.target.files) return;

    if (e.target.files[0].size > 5000000) {
      toast.error("¡El archivo es muy grande! Máximo 5MB");
      return;
    }

    const audioBlob = URL.createObjectURL(e.target.files[0]);
    setPreviewAudios((old) => [
      ...old,
      {
        number: number,
        url: audioBlob,
        name: e.target.files[0].name,
      },
    ]);

    const selectedMedias = Array.from(e.target.files);
    setMedias((old) => [...old, selectedMedias[0]]);

    document.querySelector(
      `.audio${number}`
    ).innerHTML = `<audio controls="controls">
    <source src="${audioBlob}" type="audio/mp3" />
    tu navegador no soporta HTML5
  </audio>`;
    document.querySelector(`.btnAudio${number}`).remove();
  };

  const handleChangeVideos = (e, number) => {
    if (!e.target.files) return;

    if (e.target.files[0].size > 20000000) {
      toast.error("¡El archivo es muy grande! Máximo 20MB");
      return;
    }

    const videoBlob = URL.createObjectURL(e.target.files[0]);
    setPreviewVideos((old) => [
      ...old,
      {
        number: number,
        url: videoBlob,
        name: e.target.files[0].name,
      },
    ]);

    var divConteudo = document.createElement("div");

    const selectedMedias = Array.from(e.target.files);
    setMedias((old) => [...old, selectedMedias[0]]);

    divConteudo.innerHTML = `<video controls="controls" style="width: 200px;">
    <source src="${videoBlob}" type="video/mp4" />
    tu navegador no soporta HTML5
  </video>`;

    document.querySelector(`.video${number}`).appendChild(divConteudo);
    document.querySelector(`.btnVideo${number}`).remove();
  };
  // ✅ FUNCIÓN PARA MANEJAR SUBIDA DE DOCUMENTOS
  const handleChangeDocuments = async (e, number) => {
    if (!e.target.files) return;

    // Validar tamaño máximo 15MB
    if (e.target.files[0].size > 15 * 1024 * 1024) {
      toast.error("¡El archivo es muy grande! Máximo 15MB");
      return;
    }

    // Validar tipos de archivo
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed'
    ];

    if (!allowedTypes.includes(e.target.files[0].type) && !e.target.files[0].name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar)$/i)) {
      toast.error("Tipo de archivo no permitido. Use PDF, Word, Excel, PowerPoint, TXT, ZIP o RAR");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("medias", e.target.files[0]);

      // ✅ USAR TU ENDPOINT EXISTENTE para subir el documento
      // Necesitamos un ticketId temporal - puedes usar uno fijo o crear uno temporal
      const tempTicketId = "temp-document-upload"; // O puedes obtener un ticket real si está disponible

      const response = await api.post(`/messages/${tempTicketId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200) {
        // El archivo se subió exitosamente a tu servidor
        const selectedMedias = Array.from(e.target.files);
        setMedias((old) => [...old, selectedMedias[0]]);

        // ✅ OBTENER LA URL DEL ARCHIVO SUBIDO
        // El archivo se guarda en: public/[nombre-archivo]
        const fileName = e.target.files[0].name;
        const fileUrl = `${process.env.REACT_APP_BACKEND_URL}/public/${fileName}`;

        // Actualizar el botón para mostrar éxito
        const button = document.querySelector(`.btnDocument${number}`);
        if (button) {
          button.innerHTML = `✅ ${selectedMedias[0].name}`;
          // Guardar la URL en un data attribute
          button.setAttribute('data-url', fileUrl);
          button.setAttribute('data-filename', fileName);
        }

        toast.success("Documento subido exitosamente");
      }
    } catch (error) {
      console.error("Error subiendo documento:", error);
      toast.error("Error al subir el documento");
    } finally {
      setLoading(false);
    }
  };
  const imgLayout = (number, valueDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #0000FF",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
        }}
        className={`stackImg${number}`}
        key={`stackImg${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "img")} />
        </Stack>
        <Typography textAlign={"center"}>Imagen</Typography>
        <Stack direction={"row"} justifyContent={"center"}>
          <img
            src={
              valueDefault.length > 0
                ? process.env.REACT_APP_BACKEND_URL + "/public/" + valueDefault
                : ""
            }
            className={`img${number}`}
            style={{ width: "200px" }}
          />
        </Stack>
        {valueDefault.length === 0 && (
          <Button
            variant="contained"
            component="label"
            className={`btnImg${number}`}
          >
            Enviar imagen
            <input
              type="file"
              accept="image/png, image/jpg, image/jpeg"
              hidden
              onChange={(e) => handleChangeMediasImg(e, number)}
            />
          </Button>
        )}
      </Stack>
    );
  };

  const audioLayout = (number, valueDefault = "", valueRecordDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #0000FF",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
        }}
        className={`stackAudio${number}`}
        key={`stackAudio${number}`}
      >
        <Stack
          sx={{ position: "absolute", right: 6 }}
          direction={"row"}
          gap={1}
        >
          {/* <KeyboardArrowUp
          onClick={() => moveElementUp(`audio${number}`)}
          sx={{ cursor: "pointer" }}
        />
        <KeyboardArrowDown
          onClick={() => moveElementDown(`audio${number}`)}
          sx={{ cursor: "pointer" }}
        /> */}
          <Delete
            sx={{ cursor: "pointer" }}
            onClick={() => deleteElementsTypeOne(number, "audio")}
          />
        </Stack>
        <Typography textAlign={"center"}>Audio</Typography>
        <div
          className={`audio${number}`}
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          {valueDefault.length > 0 && (
            <audio controls="controls">
              <source
                src={
                  process.env.REACT_APP_BACKEND_URL + "/public/" + valueDefault
                }
                type="audio/mp3"
              />
              tu navegador no soporta HTML5
            </audio>
          )}
        </div>
        {valueDefault.length === 0 && (
          <Button
            variant="contained"
            component="label"
            className={`btnAudio${number}`}
          >
            Enviar audio
            <input
              type="file"
              accept="audio/ogg, audio/mp3, audio/opus"
              hidden
              onChange={(e) => handleChangeAudios(e, number)}
            />
          </Button>
        )}
        <Stack direction={"row"} justifyContent={"center"}>
          <Checkbox
            className={`checkaudio${number}`}
            defaultChecked={valueRecordDefault === "ok" ? false : true}
          />
          <Stack justifyContent={"center"}>
            <Typography>Enviar como audio grabado al momento</Typography>
          </Stack>
        </Stack>
      </Stack>
    );
  };

  const videoLayout = (number, valueDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #0000FF",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
        }}
        className={`stackVideo${number}`}
        key={`stackVideo${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "video")} />
        </Stack>
        <Typography textAlign={"center"}>Vídeo</Typography>
        <div
          className={`video${number}`}
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          {valueDefault.length > 0 && (
            <video controls="controls" style={{ width: "200px" }}>
              <source
                src={
                  process.env.REACT_APP_BACKEND_URL + "/public/" + valueDefault
                }
                type="video/mp4"
              />
              tu navegador no soporta HTML5
            </video>
          )}
        </div>
        {valueDefault.length === 0 && (
          <Button
            variant="contained"
            component="label"
            className={`btnVideo${number}`}
          >
            Enviar vídeo
            <input
              type="file"
              accept="video/mp4"
              hidden
              onChange={(e) => handleChangeVideos(e, number)}
            />
          </Button>
        )}
      </Stack>
    );
  };

  const imgUrlLayout = (number, valueDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #1976d2",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
          backgroundColor: "#f0f8ff"
        }}
        className={`stackImgUrl${number}`}
        key={`stackImgUrl${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "imgUrl")} />
        </Stack>
        <Typography textAlign={"center"} sx={{ color: "#1976d2", fontWeight: "bold" }}>
          Imagen con URL/Variables
        </Typography>
        <TextField
          label={"URL de la imagen (usa variables {{nombre}})"}
          defaultValue={valueDefault}
          className={`imgUrl${number}`}
          name="imgUrl"
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
          helperText="Ejemplo: https://ejemplo.com/{{product_id}}.jpg o {{user_avatar}}"
        />
        {valueDefault && !valueDefault.includes("{{") && (
          <Stack direction={"row"} justifyContent={"center"} sx={{ mt: 1 }}>
            <img
              src={valueDefault}
              style={{ width: "200px", maxHeight: "150px", objectFit: "contain" }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </Stack>
        )}
        {valueDefault && valueDefault.includes("{{") && (
          <Stack direction={"row"} justifyContent={"center"} sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ color: "#1976d2", fontStyle: "italic" }}>
              ✅ Usa variables - Se resolverá en tiempo de ejecución
            </Typography>
          </Stack>
        )}
      </Stack>
    );
  };
  // ✅ COMPONENTE PARA DOCUMENTO LOCAL
  const documentLayout = (number, valueDefault = "", captionDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #28a745",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
        }}
        className={`stackDocument${number}`}
        key={`stackDocument${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "document")} />
        </Stack>
        <Typography textAlign={"center"} sx={{ color: "#28a745", fontWeight: "bold" }}>
          Documento
        </Typography>

        {valueDefault.length > 0 && (
          <Stack direction={"row"} justifyContent={"center"} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontStyle: "italic" }}>
              📄 {valueDefault}
            </Typography>
          </Stack>
        )}

        {valueDefault.length === 0 && (
          <Button
            variant="contained"
            component="label"
            className={`btnDocument${number}`}
            sx={{ backgroundColor: "#28a745", mt: 1 }}
          >
            Subir documento
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
              hidden
              onChange={(e) => handleChangeDocuments(e, number)}
            />
          </Button>
        )}

        <TextField
          label="Descripción (opcional)"
          defaultValue={captionDefault}
          className={`captionDocument${number}`}
          name="caption"
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
          helperText="Texto que aparecerá con el documento"
        />
      </Stack>
    );
  };

  // ✅ COMPONENTE PARA DOCUMENTO POR URL
  const documentUrlLayout = (number, valueDefault = "", captionDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #17a2b8",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
          backgroundColor: "#f0f8ff"
        }}
        className={`stackDocumentUrl${number}`}
        key={`stackDocumentUrl${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "documentUrl")} />
        </Stack>
        <Typography textAlign={"center"} sx={{ color: "#17a2b8", fontWeight: "bold" }}>
          Documento con URL/Variables
        </Typography>
        <TextField
          label={"URL del documento (usa variables {{nombre}})"}
          defaultValue={valueDefault}
          className={`documentUrl${number}`}
          name="documentUrl"
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
          helperText="Ejemplo: https://ejemplo.com/{{report_name}}.pdf"
        />
        <TextField
          label="Descripción (opcional)"
          defaultValue={captionDefault}
          className={`captionDocumentUrl${number}`}
          name="caption"
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
        />
        {valueDefault && valueDefault.includes("{{") && (
          <Stack direction={"row"} justifyContent={"center"} sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ color: "#17a2b8", fontStyle: "italic" }}>
              ✅ Usa variables - Se resolverá en tiempo de ejecución
            </Typography>
          </Stack>
        )}
      </Stack>
    );
  };
  const messageLayout = (number, valueDefault = "") => {
    return (
      <Stack
        sx={{
          border: "1px solid #0000FF",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
        }}
        className={`stackMessage${number}`}
        key={`stackMessage${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "message")} />
        </Stack>
        <Typography textAlign={"center"}>Texto</Typography>
        <TextField
          label={"Mensaje"}
          defaultValue={valueDefault}
          multiline
          rows={7}
          className={`message${number}`}
          name="text"
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
        />
      </Stack>
    );
  };

  const intervalLayout = (number, valueDefault = 0) => {
    return (
      <Stack
        sx={{
          border: "1px solid #0000FF",
          borderRadius: "7px",
          padding: "6px",
          position: "relative",
        }}
        className={`stackInterval${number}`}
        key={`stackInterval${number}`}
      >
        <Stack sx={{ position: "absolute", right: 6 }}>
          <Delete onClick={() => deleteElementsTypeOne(number, "interval")} />
        </Stack>
        <Typography textAlign={"center"}>Intervalo</Typography>
        <TextField
          label={"Tiempo en segundos"}
          className={`interval${number}`}
          defaultValue={valueDefault}
          type="number"
          InputProps={{ inputProps: { min: 0, max: 120 } }}
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
        />
      </Stack>
    );
  };

  useEffect(() => {
    const localVariables = localStorage.getItem("variables");
    if (localVariables) {
      setVariables(JSON.parse(localVariables));
    }

    if (open === "edit") {
      setLabels({
        title: "Editar contenido",
        btn: "Guardar",
      });

      setElementsSeq(data.data.seq);
      setElementsSeqEdit(data.data.seq);
      setElementsEdit(data.data.elements);

      if (data) {
        const elementsEditLoc = data.data.elements;
        const sequence = data.data.seq;

        sequence.map((item) => {
          const itemNode = elementsEditLoc.filter(
            (inode) => inode.number === item
          )[0];

          if (itemNode.type === "message") {
            const numberLoc = parseInt(item.replace("message", ""));
            setElements((elm) => [
              ...elm,
              messageLayout(numberLoc, itemNode.value),
            ]);
            setNumberMessages((old) => {
              const arsOnly = sequence.filter((item) =>
                item.includes("message")
              );
              const arrNumberMax = arsOnly.map((item) =>
                parseInt(item.replace("message", ""))
              );
              setNumberMessagesLast(Math.max.apply(null, arrNumberMax) + 1);
              return old + 1;
            });
          }

          if (itemNode.type === "interval") {
            const numberLoc = parseInt(item.replace("interval", ""));
            setElements((elm) => [
              ...elm,
              intervalLayout(numberLoc, itemNode.value),
            ]);
            setNumberInterval((old) => {
              const arsOnly = sequence.filter((item) =>
                item.includes("interval")
              );
              const arrNumberMax = arsOnly.map((item) =>
                parseInt(item.replace("interval", ""))
              );
              setNumberIntervalLast(Math.max.apply(null, arrNumberMax) + 1);
              return old + 1;
            });
          }

          if (itemNode.type === "audio") {
            const numberLoc = parseInt(item.replace("audio", ""));
            setElements((elm) => [
              ...elm,
              audioLayout(
                numberLoc,
                itemNode.value,
                itemNode.record ? "" : "ok"
              ),
            ]);
            setNumberAudio((old) => {
              const arsOnly = sequence.filter((item) => item.includes("audio"));
              const arrNumberMax = arsOnly.map((item) =>
                parseInt(item.replace("audio", ""))
              );
              setNumberAudioLast(Math.max.apply(null, arrNumberMax) + 1);
              return old + 1;
            });
          }

          if (itemNode.type === "img") {
            const numberLoc = parseInt(item.replace("img", ""));
            setElements((elm) => [
              ...elm,
              imgLayout(numberLoc, itemNode.value),
            ]);
            setNumberImg((old) => {
              const arsOnly = sequence.filter((item) => item.includes("img"));
              const arrNumberMax = arsOnly.map((item) =>
                parseInt(item.replace("img", ""))
              );
              setNumberImgLast(Math.max.apply(null, arrNumberMax) + 1);
              return old + 1;
            });
          }

          if (itemNode.type === "video") {
            const numberLoc = parseInt(item.replace("video", ""));
            setElements((elm) => [
              ...elm,
              videoLayout(numberLoc, itemNode.value),
            ]);
            setNumberVideo((old) => {
              const arsOnly = sequence.filter((item) => item.includes("video"));
              const arrNumberMax = arsOnly.map((item) =>
                parseInt(item.replace("video", ""))
              );
              setNumberVideoLast(Math.max.apply(null, arrNumberMax) + 1);
              return old + 1;
            });
          }

          if (itemNode.type === "imgUrl") {
            const numberLoc = parseInt(item.replace("imgUrl", ""));
            setElements((elm) => [
              ...elm,
              imgUrlLayout(numberLoc, itemNode.value),
            ]);
            setNumberImgUrl((old) => {
              const arsOnly = sequence.filter((item) => item.includes("imgUrl"));
              const arrNumberMax = arsOnly.map((item) =>
                parseInt(item.replace("imgUrl", ""))
              );
              setNumberImgUrlLast(Math.max.apply(null, arrNumberMax) + 1);
              return old + 1;
            });
          }
        });
      }

      setActiveModal(true);
    }

    if (open === "create") {
      setLabels({
        title: "Agregar menú al flujo",
        btn: "Agregar",
      });
      setTextDig();
      setArrayOption([]);
      setActiveModal(true);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = async () => {
    close(null);
    setActiveModal(false);
    setTimeout(() => {
      setMedias([]);
      setPreviewImg([]);
      setPreviewAudios([]);
      setPreviewVideos([]);
      setPreviewDocuments([]);
      setArrayOption([]);
      setElements([]);
      setElementsSeq([]);
      setElementsEdit([]);
      setElementsSeqEdit([]);
      setNumberMessages(0);
      setNumberMessagesLast(0);
      setNumberInterval(0);
      setNumberIntervalLast(0);
      setNumberAudio(0);
      setNumberAudioLast(0);
      setNumberVideo(0);
      setNumberVideoLast(0);
      setNumberImg(0);
      setNumberImgLast(0);
      setNumberImgUrl(0);
      setNumberImgUrlLast(0);
      setNumberDocument(0); // ✅ AGREGAR ESTE
      setNumberDocumentLast(0); // ✅ AGREGAR ESTE
      setNumberDocumentUrl(0); // ✅ AGREGAR ESTE
      setNumberDocumentUrlLast(0); // ✅ AGREGAR ESTE
    }, 500);
  };

  const verifyButtonsUpload = () => {
    const newArrImg = elementsSeq.filter((item) => item.includes("img"));
    const newArrImgUrl = elementsSeq.filter((item) => item.includes("imgUrl"));
    const newArrAudio = elementsSeq.filter((item) => item.includes("audio"));
    const newArrVideo = elementsSeq.filter((item) => item.includes("video"));
    const newArrDocument = elementsSeq.filter((item) => item.includes("document"));
    const newArrDocumentUrl = elementsSeq.filter((item) => item.includes("documentUrl"));

    // ✅ VERIFICAR IMÁGENES
    for (let i = 0; i < numberImg; i++) {
      const imgVerify = document.querySelector(`.btn${capitalize(newArrImg[i])}`);
      if (imgVerify) {
        return true;
      }
    }

    // ✅ VERIFICAR IMÁGENES URL
    for (let i = 0; i < numberImgUrl; i++) {
      const imgUrlValue = document
        .querySelector(`.${newArrImgUrl[i]}`)
        .querySelector(".MuiInputBase-input").value;
      if (!imgUrlValue) {
        return true;
      }
    }

    // ✅ VERIFICAR AUDIOS
    for (let i = 0; i < numberAudio; i++) {
      const audioVerify = document.querySelector(`.btn${capitalize(newArrAudio[i])}`);
      if (audioVerify) {
        return true;
      }
    }

    // ✅ VERIFICAR VIDEOS
    for (let i = 0; i < numberVideo; i++) {
      const videoVerify = document.querySelector(`.btn${capitalize(newArrVideo[i])}`);
      if (videoVerify) {
        return true;
      }
    }

    // ✅ VERIFICAR DOCUMENTOS LOCALES
    for (let i = 0; i < numberDocument; i++) {
      const documentVerify = document.querySelector(`.btn${capitalize(newArrDocument[i])}`);
      if (documentVerify) {
        return true;
      }
    }

    // ✅ VERIFICAR DOCUMENTOS URL
    for (let i = 0; i < numberDocumentUrl; i++) {
      const documentUrlValue = document
        .querySelector(`.${newArrDocumentUrl[i]}`)
        .querySelector(".MuiInputBase-input").value;
      if (!documentUrlValue) {
        return true;
      }
    }

    return false;
  };

  const handleSaveNode = async () => {
    if (open === "edit") {
      setLoading(true);
      const formData = new FormData();

      medias.forEach(async (media, idx) => {
        const file = media;

        if (!file) return;

        if (media?.type.split("/")[0] === "image") {
          new Compressor(file, {
            quality: 0.7,
            async success(media) {
              formData.append("medias", media);
              formData.append("body", media.name);
            },
            error(err) {
              alert("error");
              console.log(err.message);
            },
          });
        } else {
          formData.append("medias", media);
          formData.append("body", media.name);
        }
      });

      setTimeout(async () => {
        if (
          (numberAudio === 0 && numberVideo === 0 && numberImg === 0) ||
          medias.length === 0
        ) {
          try {
            const mountData = {
              seq: elementsSeq,
              elements: handleElements(null),
            };
            // ✅ DEBUG CRÍTICO
            console.log("🔍 DEBUG - Datos a guardar en singleBlock:", {
              seq: mountData.seq,
              elements: mountData.elements,
              elementsCount: mountData.elements?.length || 0,
              tieneImgUrl: mountData.elements?.some(el => el.type === "imgUrl"),
              todosLosTipos: mountData.elements?.map(el => el.type)
            });

            if (mountData.elements?.length === 0) {
              console.error("❌ ERROR: elements está vacío pero seq no");
              toast.error("Error: El contenido no se guardó correctamente");
              setLoading(false);
              return;
            }
            onUpdate({
              ...data,
              data: mountData,
            });
            toast.success("¡Contenido guardado con éxito!");
            handleClose();
            setLoading(false);
            return;
          } catch (e) {
            console.log(e);
            setLoading(false);
          }
          return;
        }

        const verify = verifyButtonsUpload();
        if (verify) {
          setLoading(false);
          return toast.error("Elimina las tarjetas vacías (Imagen, Audio y Video)");
        }

        await api
          .post("/flowbuilder/content", formData)
          .then(async (res) => {
            const mountData = {
              seq: elementsSeq,
              elements: handleElements(res.data),
            };
            onUpdate({
              ...data,
              data: mountData,
            });
            toast.success("¡Contenido guardado con éxito!");
            await handleClose();
            setLoading(false);
          })
          .catch((error) => {
            console.log(error);
          });
      }, 1500);
    } else if (open === "create") {
      setLoading(true);
      const formData = new FormData();

      medias.forEach(async (media, idx) => {
        const file = media;

        if (!file) return;

        if (media?.type.split("/")[0] === "image") {
          new Compressor(file, {
            quality: 0.7,
            async success(media) {
              formData.append("medias", media);
              formData.append("body", media.name);
            },
            error(err) {
              alert("error");
              console.log(err.message);
            },
          });
        } else {
          formData.append("medias", media);
          formData.append("body", media.name);
        }
      });

      setTimeout(async () => {
        if (numberAudio === 0 && numberVideo === 0 && numberImg === 0) {
          try {
            const mountData = {
              seq: elementsSeq,
              elements: handleElements(null),
            };
            onSave({
              ...mountData,
            });
            toast.success("¡Contenido guardado con éxito!");
            handleClose();
            setLoading(false);
            return;
          } catch (e) {
            setLoading(false);
          }
        }

        const verify = verifyButtonsUpload();
        if (verify) {
          setLoading(false);
          return toast.error("Elimina las tarjetas vacías (Imagen, Audio y Video)");
        }

        await api
          .post("/flowbuilder/content", formData)
          .then((res) => {
            const mountData = {
              seq: elementsSeq,
              elements: handleElements(res.data),
            };
            onSave({
              ...mountData,
            });
            toast.success("¡Contenido guardado con éxito!");
            handleClose();
            setLoading(false);
          })
          .catch((error) => {
            console.log(error);
          });
      }, 1500);
    }
  };

  const scrollToBottom = (className) => {
    const element = document.querySelector(className);
    element.scrollTop = element.scrollHeight;
  };

  const variableFormatter = (item) => {
    return "{{" + item + "}}";
  };

  return (
    <div>
      <Dialog open={activeModal} fullWidth="md" scroll="paper">
        {!loading && (
          <DialogTitle id="form-dialog-title">
            Agregar contenido al flujo
          </DialogTitle>
        )}
        <Stack>
          <Stack
            className="body-card"
            style={{
              gap: "8px",
              padding: "16px",
              overflow: "auto",
              height: "70vh",
              scrollBehavior: "smooth",
              display: loading && "none",
            }}
          >
            {elements.map((item) => (
              <>{item}</>
            ))}

            <Stack direction={"row"} gap={1}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [
                    ...old,
                    messageLayout(numberMessagesLast),
                  ]);
                  setNumberMessages((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `message${numberMessagesLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberMessagesLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <Message sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Texto
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [
                    ...old,
                    intervalLayout(numberIntervalLast),
                  ]);
                  setNumberInterval((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `interval${numberIntervalLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberIntervalLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <AccessTime sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Intervalo
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [...old, imgLayout(numberImgLast)]);
                  setNumberImg((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `img${numberImgLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberImgLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <Image sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Imagen
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [...old, audioLayout(numberAudioLast)]);
                  setNumberAudio((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `audio${numberAudioLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberAudioLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <MicNone sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Audio
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [...old, videoLayout(numberVideoLast)]);
                  setNumberVideo((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `video${numberVideoLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberVideoLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <Videocam sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Vídeo
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [...old, imgUrlLayout(numberImgUrlLast)]);
                  setNumberImgUrl((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `imgUrl${numberImgUrlLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberImgUrlLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
                sx={{ backgroundColor: "#1976d2" }}
              >
                <Image sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Imagen con URL/Variables
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [...old, documentLayout(numberDocumentLast)]);
                  setNumberDocument((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `document${numberDocumentLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberDocumentLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
                sx={{ backgroundColor: "#28a745" }}
              >
                <Description sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Documento
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setElements((old) => [...old, documentUrlLayout(numberDocumentUrlLast)]);
                  setNumberDocumentUrl((old) => {
                    setElementsSeq((oldEleme) => [
                      ...oldEleme,
                      `documentUrl${numberDocumentUrlLast}`,
                    ]);
                    return old + 1;
                  });
                  setNumberDocumentUrlLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
                sx={{ backgroundColor: "#17a2b8" }}
              >
                <Description sx={{ width: "16px", height: "16px", marginRight: "4px" }} />
                Documento URL
              </Button>
            </Stack>

            <Divider />

            <Box style={{ width: "100%", textAlign: "center" }}>
              <Typography>Variables</Typography>
              {variables && (
                <>
                  {variables.map((item) => (
                    <Typography>{variableFormatter(item)}</Typography>
                  ))}
                </>
              )}
            </Box>
          </Stack>

          <DialogActions>
            <Button
              onClick={handleClose}
              color="secondary"
              variant="outlined"
              style={{ display: loading && "none" }}
            >
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              onClick={() => handleSaveNode()}
              style={{ display: loading && "none" }}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>

        {loading && (
          <Stack
            style={{
              gap: "8px",
              padding: "16px",
              height: "70vh",
              alignSelf: "center",
              justifyContent: "center",
            }}
          >
            <Stack>
              <Typography>
                Subiendo los archivos y creando el contenido...
              </Typography>
              <Stack style={{ alignSelf: "center", marginTop: "12px" }}>
                <CircularProgress />
              </Stack>
            </Stack>
          </Stack>
        )}
      </Dialog>
    </div>
  );
};

export default FlowBuilderSingleBlockModal;
