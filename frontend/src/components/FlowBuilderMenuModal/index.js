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
import { AddCircle, Delete } from "@mui/icons-material";

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
    .min(2, "¡Muy corto!")
    .max(50, "¡Muy largo!")
    .required("¡Ingrese un nombre!"),
  text: Yup.string()
    .min(2, "¡Muy corto!")
    .max(50, "¡Muy largo!")
    .required("¡Ingrese un mensaje!")
});

const FlowBuilderMenuModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [rule, setRule] = useState();
  const [textDig, setTextDig] = useState();
  const [arrayOption, setArrayOption] = useState([]);

  const [labels, setLabels] = useState({
    title: "Agregar menú al flujo",
    btn: "Agregar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar menú",
        btn: "Guardar"
      });
      setTextDig(data.data.message);
      setArrayOption(data.data.arrayOption);
      setResponseVariable(data.data.responseVariable || "");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Agregar menú al flujo",
        btn: "Agregar"
      });
      setTextDig();
      setArrayOption([]);
      setResponseVariable("");
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
    const menuData = {
      message: textDig,
      arrayOption: arrayOption,
      responseVariable: responseVariable
    };

    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: menuData
      });
    } else if (open === "create") {
      handleClose();
      onSave(menuData);
    }
  };

  const removeOption = number => {
    setArrayOption(old => old.filter(item => item.number !== number));
  };
  const [responseVariable, setResponseVariable] = useState("");
  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title" style={{ paddingBottom: "0px" }} >{labels.title}</DialogTitle>
        <Stack>
          <Stack dividers style={{ gap: "8px", padding: "16px" }}>
            <TextField
              label={"Mensaje explicativo del menú"}
              rows={4}
              name="text"
              multiline
              variant="outlined"
              value={textDig}
              onChange={e => setTextDig(e.target.value)}
              className={classes.textField}
              style={{ width: "100%" }}
            />
            <TextField
              label="Obtener respuesta desde variable (opcional)"
              placeholder="Ej: {{respuesta}}"
              variant="outlined"
              value={responseVariable}
              onChange={e => setResponseVariable(e.target.value)}
              style={{ width: "100%" }}
              helperText="Si se especifica, usará el valor de esta variable como respuesta"
            />
            <Stack direction={"row"} justifyContent={"space-between"}>
              <Typography>Agregar opción</Typography>
              <Button
                onClick={() =>
                  setArrayOption(old => [
                    ...old,
                    { number: old.length + 1, value: "" }
                  ])
                }
                color="primary"
                variant="contained"
              >
                <AddCircle />
              </Button>
            </Stack>
            {arrayOption.map((item, index) => (
              <Stack width={"100%"} key={item.number}>
                <Typography>Escriba {item.number}</Typography>
                <Stack direction={"row"} width={"100%"} style={{ gap: "8px" }}>
                  <TextField
                    placeholder={"Escriba opción"}
                    variant="outlined"
                    defaultValue={item.value}
                    style={{ width: "100%" }}
                    onChange={event =>
                      setArrayOption(old => {
                        let newArr = old;
                        newArr[index].value = event.target.value;
                        return newArr;
                      })
                    }
                  />
                  {arrayOption.length === item.number && (
                    <IconButton onClick={() => removeOption(item.number)}>
                      <Delete />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
            ))}
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

export default FlowBuilderMenuModal;
