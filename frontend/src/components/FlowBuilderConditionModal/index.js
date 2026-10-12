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
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from "@mui/material";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1
  },
  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  btnWrapper: {
    position: "relative"
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  },
  checkboxContainer: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1)
  }
}));

const selectFieldStyles = {
  ".MuiOutlinedInput-notchedOutline": {
    borderColor: "#909090"
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#000000",
    borderWidth: "thin"
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#0000FF",
    borderWidth: "thin"
  }
};

const ContactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Muy corto!")
    .max(50, "Muy largo!")
    .required("¡Ingresa un nombre!"),
  text: Yup.string()
    .min(2, "Muy corto!")
    .max(50, "Muy largo!")
    .required("¡Ingresa un mensaje!")
});

const FlowBuilderConditionModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [rule, setRule] = useState();
  const [textDig, setTextDig] = useState();
  const [valueCondition, setValueCondition] = useState();
  const [dataType, setDataType] = useState("text");
  const [sendErrorMessages, setSendErrorMessages] = useState(true); // Nuevo estado
  const [labels, setLabels] = useState({
    title: "Agregar condición al flujo",
    btn: "Agregar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar condición",
        btn: "Guardar"
      });
      setTextDig(data.data.key);
      setRule(data.data.condition);
      setValueCondition(data.data.value);
      setDataType(data.data.dataType || "text");
      setSendErrorMessages(data.data.sendErrorMessages !== false); // Por defecto true si no está definido
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Agregar condición al flujo",
        btn: "Agregar"
      });
      setTextDig();
      setRule();
      setValueCondition();
      setDataType("text");
      setSendErrorMessages(true); // Por defecto true
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const handleSaveContact = async () => {
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: {
          key: textDig,
          condition: rule,
          value: valueCondition,
          dataType: dataType,
          sendErrorMessages: sendErrorMessages // Nueva propiedad
        }
      });
      return;
    } else if (open === "create") {
      handleClose();
      onSave({
        key: textDig,
        condition: rule,
        value: valueCondition,
        dataType: dataType,
        sendErrorMessages: sendErrorMessages // Nueva propiedad
      });
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Stack>
          <Stack
            dividers
            style={{ height: "350px", gap: "8px", padding: "16px" }} // Aumentado para espacio extra
          >
            <TextField
              label={"Campo de la condición (solo una variable)"}
              rows={7}
              name="text"
              variant="outlined"
              value={textDig}
              onChange={e => setTextDig(e.target.value)}
              className={classes.textField}
              style={{ width: "95%" }}
            />
            <FormControl sx={{ width: "95%" }} size="medium">
              <InputLabel sx={selectFieldStyles} id="demo-simple-select-label">
                Regla de validación
              </InputLabel>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={rule}
                label="Regla de validación"
                onChange={e => setRule(e.target.value)}
                variant="outlined"
                color="primary"
                sx={selectFieldStyles}
              >
                <MenuItem value={"=="}> {"Igual a (==)"} </MenuItem>
                <MenuItem value={">="}> {"Mayor o igual (>=)"} </MenuItem>
                <MenuItem value={"<="}> {"Menor o igual (<=)"} </MenuItem>
                <MenuItem value={"<"}> {"Menor que (<)"} </MenuItem>
                <MenuItem value={">"}> {"Mayor que (>)"} </MenuItem>
                <MenuItem value={"!="}> {"Diferente de (!=)"} </MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ width: "95%" }} size="medium">
              <InputLabel sx={selectFieldStyles}>Tipo de dato a validar</InputLabel>
              <Select
                value={dataType}
                label="Tipo de dato a validar"
                onChange={e => setDataType(e.target.value)}
                variant="outlined"
                color="primary"
                sx={selectFieldStyles}
              >
                <MenuItem value={"text"}>Texto</MenuItem>
                <MenuItem value={"number"}>Número</MenuItem>
                <MenuItem value={"image"}>Imagen</MenuItem>
                <MenuItem value={"audio"}>Audio</MenuItem>
                <MenuItem value={"video"}>Video</MenuItem>
                <MenuItem value={"document"}>Documento</MenuItem>
                <MenuItem value={"contact"}>Contacto</MenuItem>
                <MenuItem value={"location"}>Ubicación</MenuItem>
                <MenuItem value={"sticker"}>Sticker</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={"Valor a comparar (blanco para true/false)"}
              rows={7}
              name="text"
              variant="outlined"
              value={valueCondition}
              onChange={e => setValueCondition(e.target.value)}
              className={classes.textField}
              style={{ width: "95%", marginTop: "11px" }}
            />
            
            {/* NUEVA OPCIÓN - Checkbox para controlar mensajes de error */}
            <div className={classes.checkboxContainer}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={sendErrorMessages}
                    onChange={(e) => setSendErrorMessages(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enviar mensajes de error cuando la validación falle"
              />
            </div>
          </Stack>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.btnWrapper}
              onClick={() => handleSaveContact()}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </div>
  );
};

export default FlowBuilderConditionModal;