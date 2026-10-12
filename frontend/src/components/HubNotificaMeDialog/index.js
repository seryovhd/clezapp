import React, { useContext, useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
    Button,
    TextField,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    CircularProgress,
    MenuItem,
} from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

// Estilos personalizados
const useStyles = makeStyles((theme) => ({
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

// Esquema de validación con Yup
const HubNotificaMeSchema = Yup.object().shape({
    token: Yup.string().required("Obrigatório"),
    tipo: Yup.string()
        // PARCHE 1.3.1 - WEBCHAT
        .oneOf(["Facebook", "Instagram","Webchat"], "Tipo inválido")
        .required("Obrigatório"),
        // PARCHE 1.3.1 - WEBCHAT FIN
});

const HubNotificaMeDialog = ({ open, onClose, hubnotificameId, reload }) => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const { profile } = user;

    const initialState = {
        nome: "",
        token: "",
        tipo: "",
    };

    const [hubnotificame, setHubNotificaMe] = useState(initialState);

    // Cargar datos si hay un ID
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!hubnotificameId) return;
                // envia el formulario hacia la siguiente dirección
                const { data } = await api.get(`/hub-notificame/${hubnotificameId}`);
                setHubNotificaMe({
                    nome: data.nome,
                    token: data.token,
                    tipo: data.tipo,
                });
            } catch (err) {
                toastError(err);
            }
        };
        fetchData();
    }, [hubnotificameId, open]);

    // Manejar cierre del modal
    const handleClose = () => {
        setHubNotificaMe(initialState);
        onClose();
    };

    // Guardar datos
    const handleSaveHubNotificaMe = async (values) => {
        try {
            await api.post("/hub-notificame", values);
            toast.success("Registro criado com sucesso!");
            handleClose();
        } catch (err) {
            toastError(err);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle>Adicionar Token</DialogTitle>
            <Formik
                initialValues={hubnotificame}
                enableReinitialize
                validationSchema={HubNotificaMeSchema}
                onSubmit={handleSaveHubNotificaMe}
            >
                {({ touched, errors, isSubmitting }) => (
                    <Form>
                        <DialogContent dividers>
                            {/* Campo Nome */}
                            <Field
                                as={TextField}
                                label="Nombre"
                                name="nome"
                                error={touched.nome && Boolean(errors.nome)}
                                helperText={touched.nome && errors.nome}
                                variant="outlined"
                                margin="dense"
                                fullWidth
                            />

                            {/* Campo Token */}
                            <Field
                                as={TextField}
                                label="Token"
                                name="token"
                                error={touched.token && Boolean(errors.token)}
                                helperText={touched.token && errors.token}
                                variant="outlined"
                                margin="dense"
                                fullWidth
                            />

                            {/* Select para elegir el tipo */}
                            <Field
                                as={TextField}
                                select
                                label="Tipo"
                                name="tipo"
                                error={touched.tipo && Boolean(errors.tipo)}
                                helperText={touched.tipo && errors.tipo}
                                variant="outlined"
                                margin="dense"
                                fullWidth
                            >
                                <MenuItem value="Facebook">Facebook</MenuItem>
                                <MenuItem value="Instagram">Instagram</MenuItem>
                                {/* PARCHE 1.3.1 - WEBCHAT */}
                                <MenuItem value="Webchat">WebChat</MenuItem>
                                {/* PARCHE 1.3.1 - WEBCHAT FIN */}
                            </Field>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                onClick={handleClose}
                                color="secondary"
                                disabled={isSubmitting}
                                variant="outlined"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                color="primary"
                                disabled={isSubmitting}
                                variant="contained"
                                className={classes.btnWrapper}
                            >
                                Adicionar
                                {isSubmitting && (
                                    <CircularProgress
                                        size={24}
                                        className={classes.buttonProgress}
                                    />
                                )}
                            </Button>
                        </DialogActions>
                    </Form>
                )}
            </Formik>
        </Dialog>
    );
};

export default HubNotificaMeDialog;
