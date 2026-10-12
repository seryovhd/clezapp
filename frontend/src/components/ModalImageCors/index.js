import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import ModalImage from "react-modal-image";
import api from "../../services/api";
import axios from "axios"; // Importar axios directamente para peticiones externas
import { toast } from "react-toastify";

const useStyles = makeStyles(theme => ({
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: 200,
		borderRadius: 8,
	},
}));

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [blobUrl, setBlobUrl] = useState("");
	const [isValidUrl, setIsValidUrl] = useState(true);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchImage = async () => {
			if (!imageUrl) {
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				
				// Validar la URL antes de usarla
				const url = new URL(imageUrl);
				
				// Determinar si es una URL externa o interna
				const isExternalUrl = !url.hostname.includes(window.location.hostname) && 
									!url.hostname.includes('localhost');
				
				let response;
				
				if (isExternalUrl) {
					// Para URLs externas, usar axios sin credenciales
					response = await axios.get(imageUrl, {
						responseType: "blob",
						timeout: 15000,
						withCredentials: false, // Importante: no enviar credenciales
						headers: {
							'Accept': 'image/*',
						}
					});
				} else {
					// Para URLs internas, usar la API con credenciales
					response = await api.get(imageUrl, {
						responseType: "blob",
					});
				}
				
				const blobUrl = window.URL.createObjectURL(
					new Blob([response.data], { type: response.headers["content-type"] })
				);
				setBlobUrl(blobUrl);
				setIsValidUrl(true);
			} catch (err) {
				console.error("Error al cargar imagen:", err);
				toast.error("No se pudo cargar la imagen.");
				setIsValidUrl(false);
			} finally {
				setIsLoading(false);
			}
		};

		fetchImage();

		// Cleanup
		return () => {
			if (blobUrl) {
				window.URL.revokeObjectURL(blobUrl);
			}
		};
	}, [imageUrl]);

	if (isLoading) {
		return (
			<div
				style={{
					width: 250,
					height: 200,
					borderRadius: 8,
					backgroundColor: "#f0f0f0",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#666",
					fontSize: 14,
				}}
			>
				Cargando imagen...
			</div>
		);
	}

	if (!isValidUrl) {
		return (
			<div
				style={{
					width: 250,
					height: 200,
					borderRadius: 8,
					backgroundColor: "#f0f0f0",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#666",
					fontSize: 14,
					textAlign: "center",
				}}
			>
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
			hideDownload={true}
			hideZoom={false}
		/>
	);
};

export default ModalImageCors;