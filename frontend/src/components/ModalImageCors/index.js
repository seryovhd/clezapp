import React, { useState, useEffect } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import ModalImage from "react-modal-image";
import api from "../../services/api";
import axios from "axios";

const useStyles = makeStyles(theme => {
	const isDark = (theme.palette?.type || theme.mode) === 'dark';
	return {
		messageMedia: {
			objectFit: "cover",
			width: 250,
			height: 200,
			borderRadius: 8,
			cursor: "pointer",
		},
		placeholder: {
			width: 250,
			height: 200,
			borderRadius: 8,
			backgroundColor: isDark ? "#202c33" : "#f0f2f5",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: isDark ? "#8696a0" : "#667781",
			fontSize: 14,
			textAlign: "center",
			padding: theme.spacing(1),
		},
	};
});

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [blobUrl, setBlobUrl] = useState("");
	const [isValidUrl, setIsValidUrl] = useState(true);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let isCurrent = true;

		const fetchImage = async () => {
			if (!imageUrl) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);

				let isExternalUrl = false;
				try {
					const url = new URL(imageUrl, window.location.origin);
					isExternalUrl = !url.hostname.includes(window.location.hostname) && 
									!url.hostname.includes('localhost') &&
									!url.hostname.includes('127.0.0.1');
				} catch (e) {
					isExternalUrl = false;
				}

				if (isExternalUrl) {
					// Para URLs externas, intentar blob sin credenciales
					try {
						const response = await axios.get(imageUrl, {
							responseType: "blob",
							timeout: 10000,
							withCredentials: false,
							headers: { 'Accept': 'image/*' }
						});

						if (isCurrent && response?.data) {
							const blob = window.URL.createObjectURL(
								new Blob([response.data], { type: response.headers["content-type"] || "image/jpeg" })
							);
							setBlobUrl(blob);
							setIsValidUrl(true);
							setIsLoading(false);
							return;
						}
					} catch (corsErr) {
						// Si falla por CORS o timeout, probar carga directa nativa en el navegador
						const testImg = new window.Image();
						testImg.onload = () => {
							if (isCurrent) {
								setBlobUrl(imageUrl);
								setIsValidUrl(true);
								setIsLoading(false);
							}
						};
						testImg.onerror = () => {
							if (isCurrent) {
								console.warn("No se pudo cargar la imagen externa:", imageUrl);
								setIsValidUrl(false);
								setIsLoading(false);
							}
						};
						testImg.src = imageUrl;
						return;
					}
				} else {
					// Para URLs internas (del backend de Clezapp)
					const response = await api.get(imageUrl, {
						responseType: "blob",
					});

					if (isCurrent && response?.data) {
						const blob = window.URL.createObjectURL(
							new Blob([response.data], { type: response.headers["content-type"] || "image/jpeg" })
						);
						setBlobUrl(blob);
						setIsValidUrl(true);
						setIsLoading(false);
						return;
					}
				}
			} catch (err) {
				// Fallback de carga nativa de imagen en el navegador
				const testImg = new window.Image();
				testImg.onload = () => {
					if (isCurrent) {
						setBlobUrl(imageUrl);
						setIsValidUrl(true);
						setIsLoading(false);
					}
				};
				testImg.onerror = () => {
					if (isCurrent) {
						console.warn("No se pudo cargar la imagen:", err);
						setIsValidUrl(false);
						setIsLoading(false);
					}
				};
				testImg.src = imageUrl;
				return;
			}
		};

		fetchImage();

		return () => {
			isCurrent = false;
			if (blobUrl && blobUrl.startsWith("blob:")) {
				window.URL.revokeObjectURL(blobUrl);
			}
		};
	}, [imageUrl]);

	if (isLoading) {
		return (
			<div className={classes.placeholder}>
				Cargando imagen...
			</div>
		);
	}

	if (!isValidUrl) {
		return (
			<div className={classes.placeholder}>
				Error al mostrar la imagen
			</div>
		);
	}

	return (
		<ModalImage
			className={classes.messageMedia}
			smallSrcSet={blobUrl || imageUrl}
			medium={blobUrl || imageUrl}
			large={blobUrl || imageUrl}
			alt="Imagen adjunta"
			hideDownload={false}
			hideZoom={false}
		/>
	);
};

export default React.memo(ModalImageCors);