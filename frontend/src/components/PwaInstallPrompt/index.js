import React, { useState, useEffect } from "react";
import {
  makeStyles,
  Paper,
  Typography,
  Button,
  IconButton,
  Box,
  Slide,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@material-ui/core";
import GetAppIcon from "@material-ui/icons/GetApp";
import CloseIcon from "@material-ui/icons/Close";
import ShareIcon from "@material-ui/icons/Share";
import AddBoxIcon from "@material-ui/icons/AddBox";
import PhoneIphoneIcon from "@material-ui/icons/PhoneIphone";

const useStyles = makeStyles((theme) => ({
  floatContainer: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 99999,
    maxWidth: 390,
    width: "calc(100% - 32px)",
    borderRadius: 16,
    padding: theme.spacing(2),
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(32, 44, 51, 0.96)"
        : "rgba(255, 255, 255, 0.98)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(0, 168, 132, 0.35)"
        : "rgba(0, 128, 105, 0.2)"
    }`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 10px rgba(0, 168, 132, 0.2)"
        : "0 12px 32px rgba(0, 0, 0, 0.16), 0 2px 10px rgba(0, 128, 105, 0.15)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    [theme.breakpoints.down("xs")]: {
      bottom: 16,
      left: 16,
      right: 16,
      width: "auto",
      maxWidth: "none",
    },
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
  appIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #008069 0%, #00a884 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    boxShadow: "0 4px 10px rgba(0, 168, 132, 0.3)",
    flexShrink: 0,
    marginRight: theme.spacing(1.5),
  },
  appLogoImg: {
    width: 28,
    height: 28,
    objectFit: "contain",
  },
  title: {
    fontWeight: 700,
    fontSize: "0.98rem",
    lineHeight: 1.2,
    color: theme.palette.type === "dark" ? "#e9edef" : "#111b21",
  },
  subtitle: {
    fontSize: "0.80rem",
    lineHeight: 1.35,
    marginTop: 2,
    color: theme.palette.type === "dark" ? "#8696a0" : "#667781",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  btnInstall: {
    background: "linear-gradient(135deg, #008069 0%, #00a884 100%)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "0.82rem",
    padding: "6px 16px",
    borderRadius: 10,
    textTransform: "none",
    boxShadow: "0 4px 12px rgba(0, 168, 132, 0.3)",
    "&:hover": {
      background: "linear-gradient(135deg, #006c58 0%, #008f70 100%)",
      boxShadow: "0 6px 16px rgba(0, 168, 132, 0.4)",
    },
  },
  btnDismiss: {
    color: theme.palette.type === "dark" ? "#8696a0" : "#667781",
    fontSize: "0.80rem",
    textTransform: "none",
    fontWeight: 500,
    borderRadius: 10,
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(0, 0, 0, 0.05)",
    },
  },
  closeBtn: {
    padding: 4,
    color: theme.palette.type === "dark" ? "#8696a0" : "#667781",
  },
  iosStep: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: theme.spacing(1.5),
    fontSize: "0.9rem",
  },
  iosIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor:
      theme.palette.type === "dark" ? "#2a3942" : "#e9edef",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#00a884",
    flexShrink: 0,
  },
}));

const DISMISS_KEY = "clezapp_pwa_prompt_dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // Recordar cada 24 horas

const PwaInstallPrompt = () => {
  const classes = useStyles();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 1. Verificar si ya se ejecuta en modo standalone (ya instalada)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      return;
    }

    // 2. Verificar si el usuario la descartó recientemente
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const timePassed = Date.now() - parseInt(dismissedAt, 10);
      if (timePassed < DISMISS_DURATION_MS) {
        return;
      }
    }

    // 3. Detectar iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;

    setIsIOS(isIosDevice);

    // 4. Capturar evento nativo `beforeinstallprompt` (Android, Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Mostrar la notificación flotante tras 2 segundos para no ser invasivo al instante
      setTimeout(() => {
        setVisible(true);
      }, 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Escuchar cuando la app ya fue instalada
    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // 6. Si es iOS Safari o si el navegador no dispara beforeinstallprompt de inmediato
    // mostramos la notificación flotante con temporizador suave
    const timer = setTimeout(() => {
      if (!isStandalone) {
        setVisible(true);
      }
    }, 3500);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
        setDeferredPrompt(null);
      }
    } else {
      // Si el navegador no soporta el prompt nativo o ya pasó, mostramos modal guiado
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (!visible) {
    return null;
  }

  return (
    <>
      <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
        <Paper elevation={8} className={classes.floatContainer}>
          <div className={classes.header}>
            <Box display="flex" alignItems="center">
              <div className={classes.appIconWrapper}>
                <GetAppIcon fontSize="medium" />
              </div>
              <Box>
                <Typography className={classes.title}>
                  Instalar Clezapp Web App
                </Typography>
                <Typography className={classes.subtitle}>
                  Acceso rápido, pantalla completa y notificaciones en tiempo real.
                </Typography>
              </Box>
            </Box>
            <IconButton
              size="small"
              className={classes.closeBtn}
              onClick={handleDismiss}
              aria-label="Cerrar"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>

          <div className={classes.actions}>
            <Button
              size="small"
              className={classes.btnDismiss}
              onClick={handleDismiss}
            >
              Ahora no
            </Button>
            <Button
              size="small"
              variant="contained"
              className={classes.btnInstall}
              startIcon={<GetAppIcon />}
              onClick={handleInstallClick}
            >
              Instalar App
            </Button>
          </div>
        </Paper>
      </Slide>

      {/* Modal con instrucciones para iOS o navegadores que no soportan prompt nativo */}
      <Dialog
        open={showIOSModal}
        onClose={() => setShowIOSModal(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle style={{ fontWeight: 700 }}>
          Cómo instalar Clezapp en tu dispositivo
        </DialogTitle>
        <DialogContent dividers>
          {isIOS ? (
            <>
              <div className={classes.iosStep}>
                <div className={classes.iosIconBadge}>
                  <ShareIcon />
                </div>
                <Typography variant="body2">
                  1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.
                </Typography>
              </div>
              <div className={classes.iosStep}>
                <div className={classes.iosIconBadge}>
                  <AddBoxIcon />
                </div>
                <Typography variant="body2">
                  2. Desplázate hacia abajo y selecciona <strong>"Agregar a Inicio"</strong>.
                </Typography>
              </div>
              <div className={classes.iosStep}>
                <div className={classes.iosIconBadge}>
                  <PhoneIphoneIcon />
                </div>
                <Typography variant="body2">
                  3. Toca <strong>"Agregar"</strong> en la esquina superior derecha para finalizar.
                </Typography>
              </div>
            </>
          ) : (
            <Typography variant="body2" color="textSecondary">
              Para instalar Clezapp, haz clic en el ícono de instalación en la barra de direcciones de tu navegador (o en el menú de opciones <strong>⋮ &gt; "Instalar aplicación"</strong>).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowIOSModal(false)}
            color="primary"
            variant="contained"
            style={{ textTransform: "none", fontWeight: 600, borderRadius: 8 }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PwaInstallPrompt;
