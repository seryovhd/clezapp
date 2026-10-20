import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
	Dialog,
	IconButton,
	Tooltip,
	Typography,
	CircularProgress,
	Avatar
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import GetAppIcon from "@material-ui/icons/GetApp";
import SyncIcon from "@material-ui/icons/Sync";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
	dialogPaper: {
		backgroundColor: "transparent",
		boxShadow: "none",
		overflow: "visible",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		margin: 16,
	},
	dialogBackdrop: {
		backgroundColor: "rgba(0, 0, 0, 0.88)",
		backdropFilter: "blur(6px)",
	},
	headerContainer: {
		width: "100%",
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
		padding: "0 4px",
		maxWidth: "min(88vw, 440px)",
	},
	headerTitle: {
		fontWeight: 600,
		color: "#ffffff",
		textShadow: "0 2px 4px rgba(0,0,0,0.5)",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		marginRight: 8,
	},
	actionsContainer: {
		display: "flex",
		gap: 8,
		alignItems: "center",
		flexShrink: 0,
	},
	actionButton: {
		color: "#ffffff",
		backgroundColor: "rgba(255, 255, 255, 0.15)",
		transition: "background-color 0.2s ease, transform 0.15s ease",
		"&:hover": {
			backgroundColor: "rgba(255, 255, 255, 0.28)",
			transform: "scale(1.08)",
		},
	},
	imageContainer: {
		position: "relative",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	previewImage: {
		width: "min(88vw, 440px)",
		height: "min(88vw, 440px)",
		objectFit: "cover",
		borderRadius: "16px",
		boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
		border: "2px solid rgba(255, 255, 255, 0.2)",
		backgroundColor: "#111b21",
		transition: "filter 0.2s ease",
	},
	spin: {
		animation: "$spin 1s linear infinite",
	},
	"@keyframes spin": {
		"0%": {
			transform: "rotate(0deg)",
		},
		"100%": {
			transform: "rotate(360deg)",
		},
	},
	avatarClickable: {
		cursor: "pointer",
		transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
		"&:hover": {
			transform: "scale(1.08)",
			boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
			filter: "brightness(1.06)",
		},
	},
}));

export const ProfilePicModal = ({
	open,
	onClose,
	contact,
	src,
	title,
}) => {
	const classes = useStyles();
	const initialUrl = contact?.profilePicUrl || src || "";
	const [picUrl, setPicUrl] = useState(initialUrl);
	const [loadingPic, setLoadingPic] = useState(false);

	useEffect(() => {
		setPicUrl(contact?.profilePicUrl || src || "");
	}, [open, contact, src]);

	const handleRefreshPic = async () => {
		if (!contact?.id || loadingPic) return;
		setLoadingPic(true);
		try {
			const { data } = await api.post(`/contacts/${contact.id}/profile-pic`);
			if (data?.profilePicUrl) {
				setPicUrl(data.profilePicUrl);
			}
		} catch (err) {
			console.error("Error refreshing profile pic:", err);
		} finally {
			setLoadingPic(false);
		}
	};

	useEffect(() => {
		if (open && contact?.id && (picUrl?.includes("s96x96") || !picUrl)) {
			handleRefreshPic();
		}
	}, [open]);

	if (!open) return null;

	const displayName = title || contact?.name || "Foto de perfil";
	const effectiveUrl = picUrl || initialUrl;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			PaperProps={{ className: classes.dialogPaper }}
			BackdropProps={{ className: classes.dialogBackdrop }}
			onClick={(e) => e.stopPropagation()}
		>
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
				<div className={classes.headerContainer}>
					<Typography variant="h6" className={classes.headerTitle} title={displayName}>
						{displayName}
					</Typography>
					<div className={classes.actionsContainer}>
						{contact?.id && (
							<Tooltip title="Actualizar foto en HD desde WhatsApp">
								<span>
									<IconButton
										onClick={handleRefreshPic}
										disabled={loadingPic}
										className={classes.actionButton}
										size="small"
									>
										<SyncIcon fontSize="small" className={loadingPic ? classes.spin : ""} />
									</IconButton>
								</span>
							</Tooltip>
						)}
						{effectiveUrl && (
							<Tooltip title="Descargar foto">
								<IconButton
									component="a"
									href={effectiveUrl}
									download={`${displayName}.jpg`}
									target="_blank"
									rel="noreferrer"
									className={classes.actionButton}
									size="small"
								>
									<GetAppIcon fontSize="small" />
								</IconButton>
							</Tooltip>
						)}
						<IconButton
							onClick={onClose}
							className={classes.actionButton}
							size="small"
							title="Cerrar"
						>
							<CloseIcon fontSize="small" />
						</IconButton>
					</div>
				</div>

				<div className={classes.imageContainer}>
					<img
						src={effectiveUrl}
						alt={displayName}
						loading="lazy"
						decoding="async"
						className={classes.previewImage}
						style={{
							filter: loadingPic ? "brightness(0.65)" : "none",
						}}
					/>
					{loadingPic && (
						<CircularProgress
							size={48}
							style={{
								position: "absolute",
								color: "#ffffff",
							}}
						/>
					)}
				</div>
			</div>
		</Dialog>
	);
};

export const AvatarWithPreview = React.memo(({
	contact,
	src,
	alt,
	className,
	style,
	children,
	tooltipTitle = "Clic para ampliar foto",
	disablePreview = false,
	...rest
}) => {
	const classes = useStyles();
	const [modalOpen, setModalOpen] = useState(false);

	const effectiveSrc = src || contact?.profilePicUrl;
	const hasImage = Boolean(effectiveSrc);

	if (!hasImage || disablePreview) {
		return (
			<Avatar
				src={effectiveSrc}
				alt={alt || contact?.name}
				className={className}
				style={style}
				imgProps={{ loading: "lazy", decoding: "async", ...(rest.imgProps || {}) }}
				{...rest}
			>
				{children}
			</Avatar>
		);
	}

	const handleClick = (e) => {
		e.stopPropagation();
		e.preventDefault();
		setModalOpen(true);
	};

	return (
		<>
			<Tooltip title={tooltipTitle} arrow>
				<Avatar
					src={effectiveSrc}
					alt={alt || contact?.name}
					className={`${className || ""} ${classes.avatarClickable}`.trim()}
					style={style}
					onClick={handleClick}
					imgProps={{ loading: "lazy", decoding: "async", ...(rest.imgProps || {}) }}
					{...rest}
				>
					{children}
				</Avatar>
			</Tooltip>
			<ProfilePicModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				contact={contact}
				src={effectiveSrc}
				title={alt || contact?.name}
			/>
		</>
	);
});

export default React.memo(ProfilePicModal);
