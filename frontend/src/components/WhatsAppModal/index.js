// WhatsAppModal.js - VERSIÓN CON FACEBOOK MESSENGER

import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green, blue, pink } from "@material-ui/core/colors";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  DialogActions,
  CircularProgress,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Card,
  CardContent,
  Divider,
  Collapse,
  Chip,
} from "@material-ui/core";

import {
  FileCopy as CopyIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Message as MessageIcon,
  TransferWithinAStation as TransferIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Facebook as FacebookIcon,
  WhatsApp as WhatsAppIcon,
  Business as BusinessIcon,
} from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },

  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
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

  businessInfo: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },

  facebookInfo: {
    backgroundColor: blue[50],
    border: `1px solid ${blue[200]}`,
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },

  tokenField: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },

  tabPanel: {
    paddingTop: theme.spacing(2),
  },

  card: {
    marginBottom: theme.spacing(2),
    all: "initial",
  },

  cardHeader: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    color: theme.palette.primary.main,
  },

  compactField: {
    marginBottom: theme.spacing(1),
  },

  infoText: {
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
    lineHeight: 1.4,
  },

  transferGrid: {
    marginTop: theme.spacing(1),
  },

  // Nuevos estilos para header y footer fijos
  fixedHeader: {
    position: 'sticky',
    top: 0,
    backgroundColor: theme.palette.background.paper,
    zIndex: theme.zIndex.modal + 1,
    borderBottom: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2, 3, 1, 3),
    margin: 0,
  },

  fixedFooter: {
    position: 'sticky',
    bottom: 0,
    backgroundColor: theme.palette.background.paper,
    zIndex: theme.zIndex.modal + 1,
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(2, 3),
    margin: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },

  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },

  scrollableContent: {
    padding: theme.spacing(1, 3),
    maxHeight: '60vh',
    overflowY: 'auto',
    '&::-webkit-scrollbar': {
      width: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: theme.palette.background.default,
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.palette.grey[400],
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: theme.palette.grey[600],
    },
  },

  dialogPaper: {
    overflow: 'hidden',
  },

  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  closeButton: {
    color: theme.palette.grey[500],
  },

  advancedOptionsButton: {
    backgroundColor: theme.palette.background.default,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },

  advancedOptionsContainer: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
  },

  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    fontWeight: 500,
    fontSize: '0.875rem',
  },

  // Nuevos estilos para tipos de conexión
  typeChip: {
    marginLeft: theme.spacing(1),
    fontWeight: 'bold',
  },

  connectionIcon: {
    marginRight: theme.spacing(1),
  },

  connectionDescription: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
}));

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`whatsapp-tabpanel-${index}`}
      aria-labelledby={`whatsapp-tab-${index}`}
      {...other}
      className={useStyles().tabPanel}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const SessionSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
});

// Función para generar token aleatorio
const generateRandomToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const timestamp = Date.now().toString(36).slice(-6); // Agregar timestamp para mayor unicidad

  for (let i = 0; i < 20; i++) { // Longitud reducida
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return token + timestamp;
};

const WhatsAppModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState(0);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const initialState = {
    name: "",
    greetingMessage: "",
    complationMessage: "",
    outOfHoursMessage: "",
    ratingMessage: "",
    isDefault: false,
    provider: "beta",
    expiresInactiveMessage: "",
    expiresTicket: 0,
    timeUseBotQueues: 0,
    maxUseBotQueues: 3,
    type: "baileys",
    token: ""
  };
  const [whatsApp, setWhatsApp] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState(null);

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        const { data } = await api.get(`whatsapp/${whatsAppId}?session=0`);
        setWhatsApp(data);

        const whatsQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(whatsQueueIds);
        setSelectedQueueId(data.transferQueueId);
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  // Resetear opciones avanzadas cuando cambia el tipo de conexión
  useEffect(() => {
    if (whatsApp.type === "whatsapp_business" || whatsApp.type === "facebook_messenger") {
      setShowAdvancedOptions(false);
    }
  }, [whatsApp.type]);

  const handleSaveWhatsApp = async (values) => {
    try {
      // Preparar datos basados en el tipo de conexión
      let finalToken = values.token;

      // Manejar token según el tipo de conexión
      switch (values.type) {
        case "baileys":
        case "evolution":
          // Para Baileys y Evolution API, generar token si está vacío
          if (!finalToken || finalToken.trim() === "") {
            finalToken = generateRandomToken();
          }
          break;

        case "whatsapp_business":
        case "facebook_messenger":
          // Para Business y Facebook, NO usar token (se asignará después de OAuth)
          finalToken = ""; // Vacío en lugar de "pending_oauth"
          break;

        default:
          finalToken = generateRandomToken();
      }

      const whatsappData = {
        ...values,
        type: values.type,
        connectionType: values.type === "evolution" ? "evolution" : (values.type === "baileys" ? "baileys" : values.type),
        queueIds: selectedQueueIds,
        transferQueueId: selectedQueueId,
        token: finalToken
      };

      // Limpiar datos innecesarios
      delete whatsappData["queues"];
      delete whatsappData["session"];

      console.log("📤 Enviando datos:", {
        name: whatsappData.name,
        type: whatsappData.type,
        token: whatsappData.token ? "***" : "empty"
      });

      // Intentar guardar
      if (whatsAppId) {
        await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
      } else {
        await api.post("/whatsapp", whatsappData);
      }

      toast.success(i18n.t("whatsappModal.success"));
      handleClose();

    } catch (err) {
      console.error("❌ Error guardando conexión:", err.response?.data);

      // Manejar error de token duplicado
      if (err.response?.data?.error === "This whatsapp token is already used." && (values.type === "baileys" || values.type === "evolution")) {
        // Regenerar token y reintentar
        const newToken = generateRandomToken();
        const retryData = {
          ...values,
          type: values.type,
          connectionType: values.type === "evolution" ? "evolution" : (values.type === "baileys" ? "baileys" : values.type),
          queueIds: selectedQueueIds,
          transferQueueId: selectedQueueId,
          token: newToken
        };

        delete retryData["queues"];
        delete retryData["session"];

        try {
          if (whatsAppId) {
            await api.put(`/whatsapp/${whatsAppId}`, retryData);
          } else {
            await api.post("/whatsapp", retryData);
          }
          toast.success(i18n.t("whatsappModal.success") + " (Token regenerado)");
          handleClose();
        } catch (retryErr) {
          toastError(retryErr);
        }
      } else {
        toastError(err);
      }
    }
  };

  const handleGenerateToken = (setFieldValue) => {
    const newToken = generateRandomToken();
    setFieldValue("token", newToken);
    toast.success("Token generado exitosamente");
  };

  const handleCopyToken = (token) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado al portapapeles");
  };

  const handleChangeQueue = (e) => {
    setSelectedQueueIds(e);
  };

  const handleClose = () => {
    onClose();
    setWhatsApp(initialState);
    setSelectedQueueId(null);
    setSelectedQueueIds([]);
    setActiveTab(0);
    setShowAdvancedOptions(false);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const toggleAdvancedOptions = () => {
    setShowAdvancedOptions(!showAdvancedOptions);
  };

  // Función para obtener información del tipo de conexión
  const gettypeInfo = (type) => {
    const types = {
      baileys: {
        icon: <WhatsAppIcon className={classes.connectionIcon} />,
        name: "WhatsApp Normal",
        description: "Conexión directa usando Baileys. Requiere escanear código QR.",
        color: green[500]
      },
      evolution: {
        icon: <WhatsAppIcon className={classes.connectionIcon} style={{ color: "#00a884" }} />,
        name: "WhatsApp (Evolution API)",
        description: "Conexión de alta velocidad vía Evolution API v2. Requiere escanear código QR.",
        color: "#00a884"
      },
      whatsapp_business: {
        icon: <BusinessIcon className={classes.connectionIcon} />,
        name: "WhatsApp Business API",
        description: "Conexión oficial con WhatsApp Business. Requiere configuración en Facebook.",
        color: pink[500]
      },
      business: {
        icon: <BusinessIcon className={classes.connectionIcon} />,
        name: "WhatsApp Business API",
        description: "Conexión oficial con WhatsApp Business. Requiere configuración en Facebook.",
        color: pink[500]
      },
      facebook_messenger: {
        icon: <FacebookIcon className={classes.connectionIcon} />,
        name: "Facebook Messenger",
        description: "Conexión con páginas de Facebook. Maneja mensajes de Messenger.",
        color: blue[500]
      }
    };
    return types[type] || types.baileys;
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        {/* Header Fijo - SIN SCROLL */}
        <DialogTitle className={classes.fixedHeader}>
          <div className={classes.titleContainer}>
            <Typography variant="h6" component="div">
              {whatsAppId
                ? `Editar Conexión - ${whatsApp.name}`
                : "Nueva Conexión"}
            </Typography>
          </div>
        </DialogTitle>

        <Formik
          initialValues={whatsApp}
          enableReinitialize={true}
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveWhatsApp(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, touched, errors, isSubmitting, setFieldValue }) => {
            const isBaileys = values.type === "baileys";
            const isEvolution = values.type === "evolution";
            const isBusiness = values.type === "whatsapp_business";
            const isFacebook = values.type === "facebook_messenger";
            const connectionInfo = gettypeInfo(values.type);

            return (
              <Form>
                {/* Contenido Desplazable */}
                <DialogContent dividers className={classes.scrollableContent}>
                  {/* Configuración Básica */}
                  <Card className={classes.card}>
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Field
                            as={TextField}
                            label="Nombre de la Conexión"
                            autoFocus
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helperText={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.compactField}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControl
                            fullWidth
                            variant="outlined"
                            margin="dense"
                            className={classes.compactField}
                          >
                            <InputLabel>Tipo de Conexión</InputLabel>
                            <Field
                              as={Select}
                              name="type"
                              label="Tipo de Conexión"
                            >
                              <MenuItem value="baileys">
                                <Box display="flex" alignItems="center">
                                  <WhatsAppIcon style={{ marginRight: 8, color: green[500] }} />
                                  WhatsApp Normal (Baileys)
                                </Box>
                              </MenuItem>
                              <MenuItem value="evolution">
                                <Box display="flex" alignItems="center">
                                  <WhatsAppIcon style={{ marginRight: 8, color: "#00a884" }} />
                                  WhatsApp (Evolution API)
                                </Box>
                              </MenuItem>
                              <MenuItem value="whatsapp_business">
                                <Box display="flex" alignItems="center">
                                  <BusinessIcon style={{ marginRight: 8, color: pink[500] }} />
                                  WhatsApp Business API
                                </Box>
                              </MenuItem>
                              <MenuItem value="facebook_messenger">
                                <Box display="flex" alignItems="center">
                                  <FacebookIcon style={{ marginRight: 8, color: blue[500] }} />
                                  Facebook Messenger
                                </Box>
                              </MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                      </Grid>

                      {/* Información del tipo de conexión seleccionado */}
                      <Box mt={1} mb={2}>
                        <Box display="flex" alignItems="center">
                          {connectionInfo.icon}
                          <Typography variant="subtitle2" style={{ color: connectionInfo.color }}>
                            {connectionInfo.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" className={classes.connectionDescription}>
                          {connectionInfo.description}
                        </Typography>
                      </Box>

                      {isBusiness && (
                        <Box className={classes.businessInfo}>
                          <Typography variant="body2">
                            Después de guardar, haz clic en "Conectar WhatsApp Business"
                            en la tarjeta de conexión para autorizar con Whatsapp.
                          </Typography>
                        </Box>
                      )}

                      {isFacebook && (
                        <Box className={classes.facebookInfo}>
                          <Typography variant="body2">
                            Después de guardar, haz clic en "Conectar Facebook Messenger"
                            en la tarjeta de conexión para autorizar con tu página de Facebook.
                          </Typography>
                        </Box>
                      )}


                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="isDefault"
                            checked={values.isDefault}
                          />
                        }
                        label="Establecer como conexión predeterminada"
                      />
                    </CardContent>
                  </Card>

                  {/* Opciones Avanzadas para Baileys y Evolution API */}
                  {(isBaileys || isEvolution) && showAdvancedOptions && (
                    <Collapse in={showAdvancedOptions}>

                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={8}>
                          <div className={classes.tokenField}>
                            <Field
                              as={TextField}
                              label="Token de Conexión"
                              fullWidth
                              name="token"
                              variant="outlined"
                              margin="dense"
                              value={values.token || ""}
                              placeholder="Se generará automáticamente al guardar"
                              className={classes.compactField}
                            />
                            <Tooltip title="Copiar token">
                              <IconButton
                                onClick={() => handleCopyToken(values.token)}
                                size="small"
                                disabled={!values.token}
                              >
                                <CopyIcon />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<RefreshIcon />}
                            onClick={() => handleGenerateToken(setFieldValue)}
                            fullWidth
                            style={{ marginTop: 8 }}
                          >
                            Generar
                          </Button>
                        </Grid>
                      </Grid>

                      <div className={classes.advancedOptionsContainer}>
                        <Tabs
                          value={activeTab}
                          onChange={handleTabChange}
                          indicatorColor="primary"
                          textColor="primary"
                          variant="fullWidth"
                        >
                          <Tab label="Transferencias" />
                          <Tab label="Mensajes" />
                        </Tabs>

                        {/* Pestaña de Transferencias */}
                        <TabPanel value={activeTab} index={0}>
                          <Card className={classes.card}>
                            <CardContent>
                              <Typography className={classes.sectionTitle} variant="h6">
                                <TransferIcon /> Configuración de Transferencias
                              </Typography>
                              <Typography variant="subtitle2" style={{ marginTop: 16, marginBottom: 8 }}>
                                Filas Asignadas
                              </Typography>
                              <QueueSelect
                                selectedQueueIds={selectedQueueIds}
                                onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                              />
                              <Field
                                as={TextField}
                                label="Mensaje por Inactividad"
                                multiline
                                rows={3}
                                fullWidth
                                name="expiresInactiveMessage"
                                error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                                helperText={touched.expiresInactiveMessage && errors.expiresInactiveMessage}
                                variant="outlined"
                                margin="dense"
                                className={classes.compactField}
                              />
                              <Divider style={{ margin: '16px 0' }} />
                              <Grid container spacing={2} className={classes.transferGrid}>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="subtitle2">
                                    Transferencia automática por tiempo específico
                                  </Typography>
                                  <Field
                                    fullWidth
                                    type="number"
                                    as={TextField}
                                    label="Transferir después de (minutos)"
                                    name="timeToTransfer"
                                    error={touched.timeToTransfer && Boolean(errors.timeToTransfer)}
                                    helperText={touched.timeToTransfer && errors.timeToTransfer}
                                    variant="outlined"
                                    margin="dense"
                                    className={classes.compactField}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="subtitle2">
                                    Fila de Transferencia
                                  </Typography>
                                  <QueueSelect
                                    selectedQueueIds={selectedQueueId}
                                    onChange={(selectedId) => setSelectedQueueId(selectedId)}
                                    multiple={false}
                                  />
                                </Grid>
                              </Grid>
                              <Divider style={{ margin: '16px 0' }} />
                              <Typography variant="subtitle2" gutterBottom>
                                Configuración de Cierre Automático
                              </Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <Field
                                    as={TextField}
                                    label="Cerrar ticket después de (horas)"
                                    type="number"
                                    fullWidth
                                    name="expiresTicket"
                                    variant="outlined"
                                    margin="dense"
                                    error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                                    helperText={touched.expiresTicket && errors.expiresTicket}
                                    className={classes.compactField}
                                  />
                                </Grid>
                              </Grid>
                            </CardContent>
                          </Card>
                        </TabPanel>

                        {/* Pestaña de Mensajes */}
                        <TabPanel value={activeTab} index={1}>
                          <Card className={classes.card}>
                            <CardContent>
                              <Typography className={classes.sectionTitle} variant="h6">
                                <MessageIcon /> Mensajes Automáticos
                              </Typography>

                              <Field
                                as={TextField}
                                label="Mensaje de Bienvenida"
                                multiline
                                rows={3}
                                fullWidth
                                name="greetingMessage"
                                error={touched.greetingMessage && Boolean(errors.greetingMessage)}
                                helperText={touched.greetingMessage && errors.greetingMessage}
                                variant="outlined"
                                margin="dense"
                                className={classes.compactField}
                              />

                              <Field
                                as={TextField}
                                label="Mensaje de Despedida"
                                multiline
                                rows={3}
                                fullWidth
                                name="complationMessage"
                                error={touched.complationMessage && Boolean(errors.complationMessage)}
                                helperText={touched.complationMessage && errors.complationMessage}
                                variant="outlined"
                                margin="dense"
                                className={classes.compactField}
                              />

                              <Field
                                as={TextField}
                                label="Mensaje Fuera de Horario"
                                multiline
                                rows={3}
                                fullWidth
                                name="outOfHoursMessage"
                                error={touched.outOfHoursMessage && Boolean(errors.outOfHoursMessage)}
                                helperText={touched.outOfHoursMessage && errors.outOfHoursMessage}
                                variant="outlined"
                                margin="dense"
                                className={classes.compactField}
                              />

                              <Field
                                as={TextField}
                                label="Mensaje para Calificación"
                                multiline
                                rows={3}
                                fullWidth
                                name="ratingMessage"
                                error={touched.ratingMessage && Boolean(errors.ratingMessage)}
                                helperText={touched.ratingMessage && errors.ratingMessage}
                                variant="outlined"
                                margin="dense"
                                className={classes.compactField}
                              />
                            </CardContent>
                          </Card>
                        </TabPanel>
                      </div>
                    </Collapse>
                  )}

                  {/* Configuración de Transferencias para WhatsApp Business y Facebook - Siempre visible */}
                  {(isBusiness || isFacebook) && showAdvancedOptions && (
                    <Card className={classes.card}>
                      <CardContent>
                        <Typography className={classes.sectionTitle} variant="h6">
                          <TransferIcon /> Configuración de Transferencias
                        </Typography>
                        <Typography variant="subtitle2" style={{ marginTop: 16, marginBottom: 8 }}>
                          Filas Asignadas
                        </Typography>
                        <QueueSelect
                          selectedQueueIds={selectedQueueIds}
                          onChange={(selectedIds) => handleChangeQueue(selectedIds)}
                        />
                        <Field
                          as={TextField}
                          label="Mensaje por Inactividad"
                          multiline
                          rows={3}
                          fullWidth
                          name="expiresInactiveMessage"
                          error={touched.expiresInactiveMessage && Boolean(errors.expiresInactiveMessage)}
                          helperText={touched.expiresInactiveMessage && errors.expiresInactiveMessage}
                          variant="outlined"
                          margin="dense"
                          className={classes.compactField}
                        />
                        <Divider style={{ margin: '16px 0' }} />
                        <Grid container spacing={2} className={classes.transferGrid}>
                          <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2">
                              Transferencia automática por tiempo específico
                            </Typography>
                            <Field
                              fullWidth
                              type="number"
                              as={TextField}
                              label="Transferir después de (minutos)"
                              name="timeToTransfer"
                              error={touched.timeToTransfer && Boolean(errors.timeToTransfer)}
                              helperText={touched.timeToTransfer && errors.timeToTransfer}
                              variant="outlined"
                              margin="dense"
                              className={classes.compactField}
                            />
                          </Grid>

                          <Grid item xs={12} sm={6}>
                            <Typography variant="subtitle2">
                              Fila de Transferencia
                            </Typography>
                            <QueueSelect
                              selectedQueueIds={selectedQueueId}
                              onChange={(selectedId) => setSelectedQueueId(selectedId)}
                              multiple={false}
                            />
                          </Grid>
                        </Grid>

                        <Divider style={{ margin: '16px 0' }} />

                        <Typography variant="subtitle2" gutterBottom>
                          Configuración de Cierre Automático
                        </Typography>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Field
                              as={TextField}
                              label="Cerrar ticket después de (horas)"
                              type="number"
                              fullWidth
                              name="expiresTicket"
                              variant="outlined"
                              margin="dense"
                              error={touched.expiresTicket && Boolean(errors.expiresTicket)}
                              helperText={touched.expiresTicket && errors.expiresTicket}
                              className={classes.compactField}
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  )}
                </DialogContent>

                {/* Footer Fijo - SIN SCROLL */}
                <DialogActions className={classes.fixedFooter}>
                  <div className={classes.footerLeft}>
                    {(isBaileys || isEvolution || isBusiness || isFacebook) && (
                      <Button
                        className={classes.advancedOptionsButton}
                        onClick={toggleAdvancedOptions}
                        variant="outlined"
                        color="primary"
                        disabled={isSubmitting}
                      >
                        <div className={classes.buttonContent}>
                          <SettingsIcon />
                          {showAdvancedOptions ? "Ocultar Opciones" : "Opciones Avanzadas"}
                        </div>
                      </Button>
                    )}
                  </div>

                  <div className={classes.footerRight}>
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
                      {whatsAppId ? "Actualizar Conexión" : "Crear Conexión"}
                      {isSubmitting && (
                        <CircularProgress
                          size={24}
                          className={classes.buttonProgress}
                        />
                      )}
                    </Button>
                  </div>
                </DialogActions>
              </Form>
            );
          }}
        </Formik>
      </Dialog>
    </div>
  );
};

export default React.memo(WhatsAppModal);