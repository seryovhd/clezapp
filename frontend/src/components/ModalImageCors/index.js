import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress
} from "@material-ui/core";
import {
  Close as CloseIcon,
  GetApp as DownloadIcon,
  AspectRatio as ExpandIcon
} from "@material-ui/icons";
import api from "../../services/api";

const useStyles = makeStyles(theme => {
  const isDark = (theme.palette?.type || theme.mode) === 'dark';
  return {
    imageThumbnail: {
      objectFit: "cover",
      maxWidth: 300,
      maxHeight: 220,
      width: "auto",
      height: "auto",
      borderRadius: 8,
      cursor: "pointer",
      display: "block",
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      transition: "opacity 0.2s ease, transform 0.15s ease",
      "&:hover": {
        opacity: 0.95
      }
    },
    stickerThumbnail: {
      objectFit: "contain",
      width: 200,
      height: 200,
      cursor: "pointer",
      backgroundColor: "transparent",
      display: "block",
      transition: "transform 0.15s ease",
      "&:hover": {
        transform: "scale(1.03)"
      }
    },
    videoContainer: {
      position: "relative",
      maxWidth: 320,
      maxHeight: 240,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: "#000",
      display: "inline-block",
    },
    videoThumbnail: {
      maxWidth: 320,
      maxHeight: 240,
      width: "100%",
      height: "auto",
      objectFit: "contain",
      display: "block",
    },
    videoOverlayButton: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      color: "#fff",
      padding: 4,
      borderRadius: 6,
      cursor: "pointer",
      zIndex: 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background-color 0.2s ease",
      "&:hover": {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
      }
    },
    gifBadge: {
      position: "absolute",
      bottom: 8,
      left: 8,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      color: "#fff",
      fontSize: "11px",
      fontWeight: "bold",
      padding: "2px 6px",
      borderRadius: 4,
      pointerEvents: "none",
      letterSpacing: "0.5px"
    },
    placeholder: {
      width: 250,
      height: 180,
      borderRadius: 8,
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: isDark ? "#8696a0" : "#667781",
      fontSize: 13,
      textAlign: "center",
      padding: theme.spacing(1),
    },
    placeholderSticker: {
      width: 200,
      height: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: isDark ? "#8696a0" : "#667781",
      fontSize: 12,
      textAlign: "center",
      backgroundColor: "transparent",
    },
    dialogBackdrop: {
      backgroundColor: "rgba(0, 0, 0, 0.88) !important",
      backdropFilter: "blur(4px)",
    },
    dialogPaper: {
      backgroundColor: "transparent !important",
      boxShadow: "none !important",
      overflow: "visible !important",
      margin: 0,
      maxWidth: "92vw !important",
      maxHeight: "92vh !important",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },
    dialogHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      maxWidth: "88vw",
      marginBottom: 8,
      padding: "4px 10px",
      backgroundColor: "rgba(20, 20, 20, 0.75)",
      backdropFilter: "blur(8px)",
      borderRadius: 8,
      color: "#fff",
    },
    dialogTitle: {
      fontSize: 14,
      fontWeight: 500,
      color: "#f0f2f5",
      display: "flex",
      alignItems: "center",
      gap: 6
    },
    dialogActions: {
      display: "flex",
      alignItems: "center",
      gap: 4
    },
    headerIconButton: {
      color: "#fff",
      padding: 6,
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.15)",
      }
    },
    modalMediaContent: {
      maxWidth: "88vw",
      maxHeight: "82vh",
      objectFit: "contain",
      borderRadius: 8,
      outline: "none",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }
  };
});

const ModalImageCors = ({
  imageUrl,
  mediaType = "image",
  isSticker = false,
  isGif = false
}) => {
  const classes = useStyles();
  const [isValidUrl, setIsValidUrl] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const isVideo = mediaType === "video";

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const getMediaLabel = () => {
    if (isSticker) return "💟 Sticker";
    if (isGif) return "🎞️ GIF";
    if (isVideo) return "📹 Video";
    return "📷 Imagen";
  };

  const handleDownload = async (e) => {
    if (e) e.preventDefault();
    if (!imageUrl) return;

    try {
      setIsDownloading(true);
      const response = await api.get(imageUrl, {
        responseType: "blob"
      });

      if (response?.data) {
        const contentType = response.headers["content-type"] || (isVideo ? "video/mp4" : "image/jpeg");
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename = imageUrl.split("/").pop()?.split("?")[0] || (isVideo ? "video.mp4" : "archivo.jpg");
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      }
    } catch (err) {
      window.open(imageUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!imageUrl || !isValidUrl) {
    return (
      <div className={isSticker ? classes.placeholderSticker : classes.placeholder}>
        {isSticker ? "Error al mostrar sticker" : "Error al mostrar archivo"}
      </div>
    );
  }

  return (
    <>
      {/* Vista previa en la burbuja del Chat (renderizado ligero, no bloquea memoria ni Axios) */}
      {isSticker ? (
        <img
          src={imageUrl}
          alt="Sticker"
          className={classes.stickerThumbnail}
          onClick={handleOpenModal}
          loading="lazy"
          decoding="async"
          onError={() => setIsValidUrl(false)}
        />
      ) : isVideo ? (
        <div className={classes.videoContainer}>
          <Tooltip title="Ver en visor ampliado">
            <div className={classes.videoOverlayButton} onClick={handleOpenModal}>
              <ExpandIcon style={{ fontSize: 18 }} />
            </div>
          </Tooltip>
          {isGif ? (
            <>
              <video
                src={imageUrl}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className={classes.videoThumbnail}
                onClick={handleOpenModal}
                style={{ cursor: "pointer" }}
                onError={() => setIsValidUrl(false)}
              />
              <span className={classes.gifBadge}>GIF</span>
            </>
          ) : (
            <video
              src={imageUrl}
              controls
              preload="metadata"
              className={classes.videoThumbnail}
              onError={() => setIsValidUrl(false)}
            />
          )}
        </div>
      ) : (
        <img
          src={imageUrl}
          alt="Imagen adjunta"
          className={classes.imageThumbnail}
          onClick={handleOpenModal}
          loading="lazy"
          decoding="async"
          onError={() => setIsValidUrl(false)}
        />
      )}

      {/* Visor Modal Unificado con visualización en alta definición y descarga bajo demanda */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth={false}
        BackdropProps={{
          className: classes.dialogBackdrop
        }}
        PaperProps={{
          className: classes.dialogPaper
        }}
      >
        <div className={classes.dialogHeader}>
          <Typography className={classes.dialogTitle}>
            {getMediaLabel()}
          </Typography>
          <div className={classes.dialogActions}>
            <Tooltip title={isDownloading ? "Descargando..." : "Descargar archivo"}>
              <span>
                <IconButton
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={classes.headerIconButton}
                  size="small"
                >
                  {isDownloading ? (
                    <CircularProgress size={16} style={{ color: "#fff" }} />
                  ) : (
                    <DownloadIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Cerrar (Esc)">
              <IconButton
                onClick={handleCloseModal}
                className={classes.headerIconButton}
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {isVideo ? (
          <video
            src={imageUrl}
            controls
            autoPlay
            loop={isGif}
            className={classes.modalMediaContent}
          />
        ) : (
          <img
            src={imageUrl}
            alt={getMediaLabel()}
            className={classes.modalMediaContent}
            style={isSticker ? { backgroundColor: "transparent" } : undefined}
          />
        )}
      </Dialog>
    </>
  );
};

export default React.memo(ModalImageCors);