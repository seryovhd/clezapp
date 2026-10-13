import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";
import { makeStyles } from "@material-ui/core/styles";
import {
  green,
  blue,
  red,
  orange,
  deepPurple,
} from "@material-ui/core/colors";
import {
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Chip,
  Box,
  Divider,
  Typography,
  Tooltip,
  CircularProgress,
  LinearProgress,
  Paper,
  useTheme
} from "@material-ui/core";
import {
  Edit,
  CheckCircle,
  SignalCellularConnectedNoInternet2Bar,
  SignalCellularConnectedNoInternet0Bar,
  SignalCellular4Bar,
  CropFree,
  DeleteOutline,
  Refresh,
  AddCircleOutline,
  SettingsBackupRestore,
  Phone,
  AccountCircle,
  Update,
  Business,
  LinkOff,
  WhatsApp as WhatsAppIcon
} from "@material-ui/icons";
import { TbBrandFacebookFilled, TbBrandInstagram, TbMessageChatbot } from "react-icons/tb";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import formatSerializedId from '../../utils/formatSerializedId';
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import clsx from "clsx";

const useStyles = makeStyles(theme => ({
  root: {
    flex: 1,
    padding: theme.spacing(3),
    overflowY: "auto",
    ...theme.scrollbarStyles,
    backgroundColor: theme.palette.background.default,
  },
  gridContainer: {
    marginTop: theme.spacing(3),
  },
  connectionCard: {
    borderRadius: 12,
    boxShadow: theme.shadows[2],
    transition: "all 0.3s ease",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[6],
    },
  },
  cardHeader: {
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardContent: {
    padding: theme.spacing(2),
    flexGrow: 1,
    backgroundColor: theme.palette.background.paper,
  },
  cardActions: {
    padding: theme.spacing(1, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
    justifyContent: "flex-end",
    backgroundColor: theme.palette.background.paper,
  },
  avatar: {
    width: 40,
    height: 40,
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  connectedStatus: {
    color: theme.palette.type === 'dark' ? green[400] : green[600],
  },
  disconnectedStatus: {
    color: theme.palette.type === 'dark' ? red[400] : red[600],
  },
  qrcodeStatus: {
    color: theme.palette.type === 'dark' ? blue[400] : blue[600],
  },
  timeoutStatus: {
    color: theme.palette.type === 'dark' ? orange[400] : orange[600],
  },
  openingStatus: {
    color: theme.palette.type === 'dark' ? deepPurple[400] : deepPurple[600],
  },
  defaultBadge: {
    backgroundColor: theme.palette.type === 'dark' ? green[800] : green[100],
    color: theme.palette.type === 'dark' ? green[100] : green[800],
    padding: "2px 8px",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 500,
    marginLeft: theme.spacing(1),
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(1.5),
    "& svg": {
      marginRight: theme.spacing(1.5),
      color: theme.palette.text.secondary,
    },
  },
  primaryButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  secondaryButton: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  dangerButton: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.error.main}`,
    color: theme.palette.error.main,
    "&:hover": {
      backgroundColor: theme.palette.error.light,
      color: theme.palette.error.dark,
    },
  },
  headerButtons: {
    display: "flex",
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4),
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  statusIcon: {
    marginRight: theme.spacing(1.5),
  },
  progressBar: {
    marginTop: theme.spacing(1.5),
    borderRadius: 4,
    height: 6,
  },
  connectionName: {
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 120,
  },
  instagram: {
    backgroundColor: "#E1306C",
  },
  facebook: {
    backgroundColor: "#3b5998",
  },
  webchat: {
    backgroundColor: "#3065E1",
  },
  whatsapp: {
    backgroundColor: "#25D366",
  },
  telegram: {
    backgroundColor: "#229ED9",
  },
  sms: {
    backgroundColor: "#607D8B",
  },
  email: {
    backgroundColor: "#D44638",
  }
}));

const StatusIndicator = ({ status }) => {
  const classes = useStyles();
  const theme = useTheme();

  const getStatusData = () => {
    switch (status) {
      case "CONNECTED":
        return {
          icon: <SignalCellular4Bar className={classes.statusIcon} />,
          text: "Conectado",
          class: classes.connectedStatus,
          progress: 100,
        };
      case "DISCONNECTED":
        return {
          icon: <SignalCellularConnectedNoInternet0Bar className={classes.statusIcon} />,
          text: "Desconectado",
          class: classes.disconnectedStatus,
          progress: 0,
        };
      case "qrcode":
        return {
          icon: <CropFree className={classes.statusIcon} />,
          text: "QR Code",
          class: classes.qrcodeStatus,
          progress: 30,
        };
      case "TIMEOUT":
      case "PAIRING":
        return {
          icon: <SignalCellularConnectedNoInternet2Bar className={classes.statusIcon} />,
          text: "Timeout",
          class: classes.timeoutStatus,
          progress: 60,
        };
      case "OPENING":
        return {
          icon: <CircularProgress size={16} className={classes.statusIcon} />,
          text: "Conectando",
          class: classes.openingStatus,
          progress: 45,
        };
      default:
        return {
          icon: <SignalCellularConnectedNoInternet0Bar className={classes.statusIcon} />,
          text: status,
          class: classes.disconnectedStatus,
          progress: 0,
        };
    }
  };

  const statusData = getStatusData();

  return (
    <Box display="flex" alignItems="center" mb={2}>
      {statusData.icon}
      <Typography variant="body2" className={statusData.class}>
        {statusData.text}
      </Typography>
      <Box flexGrow={1} ml={1.5}>
        <LinearProgress
          variant="determinate"
          value={statusData.progress}
          className={classes.progressBar}
          style={{
            backgroundColor: theme.palette.divider,
          }}
        />
      </Box>
    </Box>
  );
};

const Connections = () => {
  const classes = useStyles();
  const theme = useTheme();

  const { user } = useContext(AuthContext);
  const { whatsApps, loading } = useContext(WhatsAppsContext);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalInfo, setConfirmModalInfo] = useState({
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  });
  React.useEffect(() => {
    const handleMessage = (event) => {
      // Verificar que el mensaje venga de una URL confiable
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'FACEBOOK_CONNECTION_SUCCESS') {
        console.log('Facebook connection successful:', event.data.pageName);
        toast.success(`Facebook conectado exitosamente: ${event.data.pageName}`);

        // La ventana se cierra automáticamente desde el callback
        // Podemos forzar un refresh de los datos si es necesario
      }

      if (event.data.type === 'FACEBOOK_CONNECTION_ERROR') {
        console.log('Facebook connection error:', event.data.reason);
        toast.error(`Error conectando Facebook: ${event.data.reason}`);
        // La ventana también se cerrará automáticamente
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleConnectBusiness = async (whatsappId) => {
    try {
      const { data } = await api.get(`/whatsapp/${whatsappId}/business/connect`);
      if (data.success && data.authUrl) {
        // ✅ SOLUCIÓN: Abrir en popup y detectar cuando se cierra
        const popup = window.open(data.authUrl, 'WhatsAppBusinessOnboarding', 'width=600,height=700,scrollbars=yes');

        if (popup) {
          toast.info(i18n.t("connections.businessApi.connecting"));

          // Verificar cada 1 segundo si el popup se cerró
          const checkPopup = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkPopup);
              console.log("Popup de WhatsApp Business cerrado - verificando estado...");

              // Esperar 2 segundos y luego verificar el estado
              setTimeout(() => {
                // Recargar la página o verificar el estado de la conexión
                window.location.reload();
              }, 2000);
            }
          }, 1000);
        } else {
          toast.error("No se pudo abrir la ventana de conexión. Por favor permite ventanas emergentes.");
        }
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleConnectFacebook = async (whatsappId) => {
    try {
      const { data } = await api.get(`/whatsapp/${whatsappId}/facebook/connect`);
      if (data.success && data.authUrl) {
        // ✅ Misma solución para Facebook
        const popup = window.open(data.authUrl, 'FacebookOnboarding', 'width=600,height=700,scrollbars=yes');

        if (popup) {
          toast.info("Conectando con Facebook Messenger...");

          const checkPopup = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkPopup);
              console.log("Popup de Facebook cerrado - verificando estado...");

              setTimeout(() => {
                window.location.reload();
              }, 2000);
            }
          }, 1000);
        } else {
          toast.error("No se pudo abrir la ventana de conexión. Por favor permite ventanas emergentes.");
        }
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleDisconnectFacebook = async (whatsappId) => {
    try {
      await api.post(`/whatsapp/${whatsappId}/facebook/disconnect`);
      toast.success("Facebook Messenger desconectado");
    } catch (err) {
      toastError(err);
    }
  };

  const handleDisconnectBusiness = async (whatsappId) => {
    try {
      await api.post(`/whatsapp/${whatsappId}/business/disconnect`);
      toast.success(i18n.t("connections.businessApi.disconnected"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleStartWhatsAppSession = async (whatsAppId, whatsAppObj) => {
    try {
      if (whatsAppObj) {
        handleOpenQrModal(whatsAppObj);
      }
      await api.post(`/whatsappsession/${whatsAppId}`);
      toast.info(i18n.t("connections.toasts.connecting"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async (whatsAppId, whatsAppObj) => {
    try {
      if (whatsAppObj) {
        handleOpenQrModal(whatsAppObj);
      }
      await api.put(`/whatsappsession/${whatsAppId}`);
      toast.info(i18n.t("connections.toasts.requestingQr"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = () => {
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
  }, []);

  const handleOpenQrModal = whatsApp => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, []);

  const handleEditWhatsApp = whatsApp => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: whatsAppId,
      });
    }

    if (action === "delete") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId: whatsAppId,
      });
    }
    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.disconnected"));
      } catch (err) {
        toastError(err);
      }
    }

    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        toastError(err);
      }
    }

    setConfirmModalInfo({
      action: "",
      title: "",
      message: "",
      whatsAppId: "",
      open: false,
    });
    setConfirmModalOpen(false);
  };

  const gettypeDisplay = (whatsApp) => {
    console.log(`gettypeDisplay for ${whatsApp.name}:`, {
      type: whatsApp.type
    });

    if (whatsApp.type === "whatsapp_business") {
      return "💼 WhatsApp Business API";
    }
    if (whatsApp.type === "facebook_messenger") {
      return "📱 Facebook Messenger";
    }
    if (whatsApp.type === "baileys") {
      return "💚 WhatsApp Normal (QR)";
    }
    if (whatsApp.type === "evolution") {
      return "🚀 WhatsApp (Evolution API)";
    }

    // Fallback al type si no hay type
    if (whatsApp.type === "WhatsApp") {
      return "💚 WhatsApp";
    }
    if (whatsApp.type === "Instagram") {
      return "📸 Instagram";
    }
    if (whatsApp.type === "Telegram") {
      return "📨 Telegram";
    }

    return whatsApp.type || "Conexión";
  };

  const renderCardActions = whatsApp => {
    console.log(`renderCardActions for ${whatsApp.name}:`, {
      type: whatsApp.type,
      status: whatsApp.status,
      facebookPageId: whatsApp.facebookPageId,
      isFacebook: whatsApp.type === "facebook_messenger",
      isBusiness: whatsApp.type === "whatsapp_business",
      isBaileys: whatsApp.type === "baileys"
    });

    const isBusiness = whatsApp.type === "whatsapp_business";
    const isFacebook = whatsApp.type === "facebook_messenger";
    const isEvolution = whatsApp.type === "evolution";
    const isBaileys = whatsApp.type === "baileys" || isEvolution || !whatsApp.type;
    const isConnected = whatsApp.status === "CONNECTED";

    // Facebook Messenger
    if (isFacebook) {
      if (whatsApp.facebookPageId) {
        return (
          <Button
            size="small"
            variant="contained"
            className={classes.dangerButton}
            startIcon={<LinkOff />}
            onClick={() => handleDisconnectFacebook(whatsApp.id)}
            fullWidth
          >
            Desconectar Facebook
          </Button>
        );
      } else {
        return (
          <Button
            size="small"
            variant="contained"
            style={{ backgroundColor: '#1877F2', color: 'white' }}
            startIcon={<TbBrandFacebookFilled />}
            onClick={() => handleConnectFacebook(whatsApp.id)}
            fullWidth
          >
            Conectar Facebook Messenger
          </Button>
        );
      }
    }

    // WhatsApp Business
    if (isBusiness) {
      if (isConnected) {
        return (
          <Button
            size="small"
            variant="contained"
            className={classes.dangerButton}
            startIcon={<LinkOff />}
            onClick={() => handleDisconnectBusiness(whatsApp.id)}
            fullWidth
          >
            {i18n.t("connections.businessApi.disconnect")}
          </Button>
        );
      } else {
        return (
          <Button
            size="small"
            variant="contained"
            className={classes.primaryButton}
            startIcon={<Business />}
            onClick={() => handleConnectBusiness(whatsApp.id)}
            fullWidth
          >
            {i18n.t("connections.businessApi.connect")}
          </Button>
        );
      }
    }

    // WhatsApp Baileys (QR)
    if (isBaileys) {
      console.log(`Baileys WhatsApp ${whatsApp.name} status:`, whatsApp.status);

      if (whatsApp.status === "qrcode" || Boolean(whatsApp.qrcode)) {
        return (
          <Button
            size="small"
            variant="contained"
            className={classes.primaryButton}
            startIcon={<CropFree />}
            onClick={() => handleOpenQrModal(whatsApp)}
            fullWidth
          >
            {i18n.t("connections.buttons.qrcode")}
          </Button>
        );
      }

      if (whatsApp.status === "DISCONNECTED") {
        console.log("Showing reconnect buttons for disconnected Baileys");
        return (
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Button
                size="small"
                variant="contained"
                className={classes.secondaryButton}
                startIcon={<Refresh />}
                onClick={() => handleStartWhatsAppSession(whatsApp.id, whatsApp)}
                fullWidth
              >
                {i18n.t("connections.buttons.tryAgain")}
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                size="small"
                variant="contained"
                className={classes.primaryButton}
                startIcon={<CropFree />}
                onClick={() => handleRequestNewQrCode(whatsApp.id, whatsApp)}
                fullWidth
              >
                {i18n.t("connections.buttons.newQr")}
              </Button>
            </Grid>
          </Grid>
        );
      }

      if (whatsApp.status === "CONNECTED" ||
        whatsApp.status === "PAIRING" ||
        whatsApp.status === "TIMEOUT") {
        return (
          <Button
            size="small"
            variant="contained"
            className={classes.dangerButton}
            startIcon={<SignalCellularConnectedNoInternet0Bar />}
            onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}
            fullWidth
          >
            {i18n.t("connections.buttons.disconnect")}
          </Button>
        );
      }

      if (whatsApp.status === "OPENING") {
        return (
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Button
                size="small"
                variant="contained"
                className={classes.primaryButton}
                startIcon={<CropFree />}
                onClick={() => handleOpenQrModal(whatsApp)}
                fullWidth
              >
                {i18n.t("connections.buttons.qrcode")}
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                size="small"
                variant="contained"
                className={classes.secondaryButton}
                startIcon={<Refresh />}
                onClick={() => handleStartWhatsAppSession(whatsApp.id, whatsApp)}
                fullWidth
              >
                {i18n.t("connections.buttons.tryAgain")}
              </Button>
            </Grid>
          </Grid>
        );
      }
    }

    // Para otros tipos de conexión
    return null;
  };

  const restartWhatsapps = async () => {
    try {
      await api.post(`/whatsapp-restart/`);
      toast.warn("Aguarde... reiniciando...");
    } catch (err) {
      toastError(err);
    }
  }

  const formatConnectionName = (name) => {
    if (name && name.length > 9) {
      return `${name.substring(0, 9)}...`;
    }
    return name;
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleSubmitConfirmationModal}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>

      <QrcodeModal
        open={qrModalOpen}
        onClose={handleCloseQrModal}
        whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
      />

      <WhatsAppModal
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
      />

      <MainHeader>
        <Title>{i18n.t("connections.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Can
            role={user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <div className={classes.headerButtons}>
                <Button
                  variant="contained"
                  className={classes.primaryButton}
                  startIcon={<AddCircleOutline />}
                  onClick={handleOpenWhatsAppModal}
                >
                  {i18n.t("connections.buttons.add")}
                </Button>
                <Button
                  variant="contained"
                  className={classes.secondaryButton}
                  startIcon={<SettingsBackupRestore />}
                  onClick={restartWhatsapps}
                >
                  {i18n.t("connections.buttons.restart")}
                </Button>
              </div>
            )}
          />
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.root} elevation={0}>
        {loading ? (
          <div className={classes.loadingContainer}>
            <CircularProgress color="primary" />
          </div>
        ) : (
          <>
            <Box mb={3}>
              <Typography variant="h6" color="textPrimary">
                {i18n.t("connections.subtitle")} {whatsApps?.length || 0} conexiones
              </Typography>
              <Divider />
            </Box>

            {whatsApps?.length > 0 ? (
              <Grid container spacing={3} className={classes.gridContainer}>
                {whatsApps.map(whatsApp => {
                  const isBusiness = whatsApp.type === "whatsapp_business";
                  const isFacebook = whatsApp.type === "facebook_messenger";
                  const isEvolution = whatsApp.type === "evolution";
                  const isBaileys = whatsApp.type === "baileys" || isEvolution || !whatsApp.type;

                  return (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={whatsApp.id}>
                      <Card className={classes.connectionCard}>
                        <Box className={classes.cardHeader}>
                          <Box display="flex" alignItems="center" minWidth={0}>
                            <Avatar className={clsx(classes.avatar, {
                              [classes.instagram]: whatsApp.type === "Instagram",
                              [classes.facebook]: isFacebook,
                              [classes.webchat]: whatsApp.type === "Webchat",
                              [classes.whatsapp]: isBaileys || isBusiness || isEvolution,
                              [classes.telegram]: whatsApp.type === "Telegram",
                              [classes.sms]: whatsApp.type === "Sms",
                              [classes.email]: whatsApp.type === "Email",
                            })}>
                              {whatsApp.type === "Instagram" ? (
                                <TbBrandInstagram size={24} />
                              ) : isFacebook ? (
                                <TbBrandFacebookFilled size={24} />
                              ) : isBusiness ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893c0-3.189-1.248-6.189-3.515-8.444" />
                                </svg>
                              ) : whatsApp.type === "Webchat" ? (
                                <TbMessageChatbot size={24} />
                              ) : isBaileys || isEvolution ? (
                                <WhatsAppIcon style={{ color: "white" }} />
                              ) : (
                                whatsApp.name?.charAt(0)?.toUpperCase() || "C"
                              )}
                            </Avatar>

                            <Box ml={1.5} minWidth={0}>
                              <Tooltip title={whatsApp.name} arrow>
                                <Typography variant="subtitle1" className={classes.connectionName}>
                                  {formatConnectionName(whatsApp.name)}
                                </Typography>
                              </Tooltip>
                              <Typography variant="caption" color="textSecondary" noWrap>
                                {gettypeDisplay(whatsApp)}
                              </Typography>
                            </Box>
                          </Box>
                          {whatsApp.isDefault && (
                            <Chip
                              label="Predet."
                              size="small"
                              icon={<CheckCircle fontSize="small" />}
                              className={classes.defaultBadge}
                            />
                          )}
                        </Box>

                        <CardContent className={classes.cardContent}>
                          <StatusIndicator status={whatsApp.status} />

                          <Box className={classes.infoItem}>
                            <Phone fontSize="small" />
                            <Typography variant="body2" noWrap>
                              {isFacebook && whatsApp.facebookPageName ? (
                                <Tooltip title={`Página: ${whatsApp.facebookPageName}`} arrow>
                                  <span>📄 {whatsApp.facebookPageName}</span>
                                </Tooltip>
                              ) : whatsApp.number ? (
                                <Tooltip title={whatsApp.number} arrow>
                                  <span>{formatSerializedId(whatsApp.number)}</span>
                                </Tooltip>
                              ) : (
                                "Número no definido"
                              )}
                            </Typography>
                          </Box>

                          <Box className={classes.infoItem}>
                            <Update fontSize="small" />
                            <Typography variant="body2">
                              {whatsApp.updatedAt ? format(parseISO(whatsApp.updatedAt), "dd/MM/yyyy HH:mm") : "N/A"}
                            </Typography>
                          </Box>
                        </CardContent>

                        <CardActions className={classes.cardActions}>
                          <Box width="100%">
                            {renderCardActions(whatsApp)}

                            <Can
                              role={user.profile}
                              perform="connections-page:editOrDeleteConnection"
                              yes={() => (
                                <Box mt={1} display="flex" justifyContent="space-between">
                                  <Button
                                    size="small"
                                    startIcon={<Edit />}
                                    onClick={() => handleEditWhatsApp(whatsApp)}
                                    color="primary"
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    size="small"
                                    startIcon={<DeleteOutline />}
                                    onClick={() => handleOpenConfirmationModal("delete", whatsApp.id)}
                                    color="secondary"
                                  >
                                    Borrar
                                  </Button>
                                </Box>
                              )}
                            />
                          </Box>
                        </CardActions>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Box className={classes.emptyState}>
                <AccountCircle style={{ fontSize: 60, color: theme.palette.text.disabled }} />
                <Typography variant="h6" gutterBottom>
                  No se encontró ninguna conexión
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Haz clic en el botón "Agregar Conexión" para comenzar
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Connections;