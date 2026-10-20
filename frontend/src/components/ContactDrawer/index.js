import React, { useEffect, useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import CreateIcon from '@material-ui/icons/Create';

import { i18n } from "../../translate/i18n";

import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";
import { CardHeader, Tooltip, Dialog, CircularProgress } from "@material-ui/core";
import GetAppIcon from "@material-ui/icons/GetApp";
import SyncIcon from "@material-ui/icons/Sync";
import { ContactForm } from "../ContactForm";
import ContactModal from "../ContactModal";
import { ContactNotes } from "../ContactNotes";
import CopyNumberButton from "../CopyNumberButton";
import api from "../../services/api";

import { generateColor } from "../../helpers/colorGenerator";
import { getInitials } from "../../helpers/getInitials";

const drawerWidth = 320;

const useStyles = makeStyles(theme => ({
	drawer: {
		width: drawerWidth,
		flexShrink: 0,
	},
	drawerPaper: {
		width: drawerWidth,
		display: "flex",
		borderTop: "1px solid rgba(0, 0, 0, 0.12)",
		borderRight: "1px solid rgba(0, 0, 0, 0.12)",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		borderTopRightRadius: 4,
		borderBottomRightRadius: 4,
	},
	header: {
		display: "flex",
		borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
		backgroundColor: theme.palette.contactdrawer, //DARK MODE Whaticket SaaS//
		alignItems: "center",
		padding: theme.spacing(0, 1),
		minHeight: "73px",
		justifyContent: "flex-start",
	},
	content: {
		display: "flex",
		backgroundColor: theme.palette.contactdrawer, //DARK MODE Whaticket SaaS//
		flexDirection: "column",
		padding: "8px 0px 8px 8px",
		height: "100%",
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},

	contactAvatar: {
		margin: 15,
		width: 100,
		height: 100,
	},

	contactHeader: {
		display: "flex",
		padding: 8,
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		"& > *": {
			margin: 4,
		},
	},

	contactDetails: {
		marginTop: 8,
		padding: 8,
		display: "flex",
		flexDirection: "column",
	},
	contactExtraInfo: {
		marginTop: 4,
		padding: 6,
	},
	avatarClickable: {
		width: 60,
		height: 60,
		color: "white",
		fontWeight: "bold",
		cursor: "pointer",
		transition: "transform 0.2s ease, box-shadow 0.2s ease",
		"&:hover": {
			transform: "scale(1.08)",
			boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
		},
	},
	avatarDefault: {
		width: 60,
		height: 60,
		color: "white",
		fontWeight: "bold",
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
}));

const ContactDrawer = ({ open, handleDrawerClose, contact, ticket, loading }) => {
	const classes = useStyles();

	const [modalOpen, setModalOpen] = useState(false);
	const [openForm, setOpenForm] = useState(false);
	const [openImageModal, setOpenImageModal] = useState(false);
	const [profilePic, setProfilePic] = useState(contact?.profilePicUrl);
	const [loadingPic, setLoadingPic] = useState(false);

	useEffect(() => {
		setOpenForm(false);
		setProfilePic(contact?.profilePicUrl);
	}, [open, contact]);

	const handleRefreshPic = async () => {
		if (!contact?.id || loadingPic) return;
		setLoadingPic(true);
		try {
			const { data } = await api.post(`/contacts/${contact.id}/profile-pic`);
			if (data?.profilePicUrl) {
				setProfilePic(data.profilePicUrl);
			}
		} catch (err) {
			console.error("Error refreshing profile pic:", err);
		} finally {
			setLoadingPic(false);
		}
	};

	useEffect(() => {
		if (openImageModal && contact?.id && (profilePic?.includes("s96x96") || !profilePic)) {
			handleRefreshPic();
		}
	}, [openImageModal]);

	return (
		<>
			<Drawer
				className={classes.drawer}
				variant="persistent"
				anchor="right"
				open={open}
				PaperProps={{ style: { position: "absolute" } }}
				BackdropProps={{ style: { position: "absolute" } }}
				ModalProps={{
					container: document.getElementById("drawer-container"),
					style: { position: "absolute" },
				}}
				classes={{
					paper: classes.drawerPaper,
				}}
			>
				<div className={classes.header}>
					<IconButton onClick={handleDrawerClose}>
						<CloseIcon />
					</IconButton>
					<Typography style={{ justifySelf: "center" }}>
						{i18n.t("contactDrawer.header")}
					</Typography>
				</div>
				{loading ? (
					<ContactDrawerSkeleton classes={classes} />
				) : (
					<div className={classes.content}>
						<Paper square variant="outlined" className={classes.contactHeader}>
							<CardHeader
								onClick={() => {}}
								style={{ cursor: "pointer", width: '100%' }}
								titleTypographyProps={{ noWrap: true }}
								subheaderTypographyProps={{ noWrap: true }}
								avatar={
									(profilePic || contact?.profilePicUrl) ? (
										<Tooltip title="Clic para ampliar foto" arrow>
											<Avatar
												src={profilePic || contact.profilePicUrl}
												alt={contact?.name || "Foto de contacto"}
												className={classes.avatarClickable}
												style={{ backgroundColor: generateColor(contact?.number) }}
												onClick={(e) => {
													e.stopPropagation();
													setOpenImageModal(true);
												}}
											>
												{getInitials(contact?.name)}
											</Avatar>
										</Tooltip>
									) : (
										<Avatar
											src={profilePic || contact?.profilePicUrl}
											alt={contact?.name || "Foto de contacto"}
											className={classes.avatarDefault}
											style={{ backgroundColor: generateColor(contact?.number) }}
										>
											{getInitials(contact?.name)}
										</Avatar>
									)
								}
								title={
									<>
										<Typography onClick={() => setOpenForm(true)}>
											{contact.name}
											<CreateIcon style={{fontSize: 16, marginLeft: 5}} />
										</Typography>
									</>
								}
								subheader={
									<>
										<Typography style={{fontSize: 12, display: "flex", alignItems: "center", gap: 4}}>
											<Link href={`tel:${contact.number}`}>{contact.number}</Link>
											{contact.number && <CopyNumberButton number={contact.number} size={13} />}
										</Typography>
										<Typography style={{fontSize: 12}}>
											<Link href={`mailto:${contact.email}`}>{contact.email}</Link>
										</Typography>
									</>
								}
							/>
							<Button
								variant="outlined"
								color="primary"
								onClick={() => setModalOpen(!openForm)}
								style={{fontSize: 12}}
							>
								{i18n.t("contactDrawer.buttons.edit")}
							</Button>
							{(contact.id && openForm) && <ContactForm initialContact={contact} onCancel={() => setOpenForm(false)} />}
						</Paper>
						<Paper square variant="outlined" className={classes.contactDetails}>
							<Typography variant="subtitle1" style={{marginBottom: 10}}>
								{i18n.t("ticketOptionsMenu.appointmentsModal.title")}
							</Typography>
							<ContactNotes ticket={ticket} />
						</Paper>
						<Paper square variant="outlined" className={classes.contactDetails}>
							<ContactModal
								open={modalOpen}
								onClose={() => setModalOpen(false)}
								contactId={contact.id}
							></ContactModal>
							<Typography variant="subtitle1">
								{i18n.t("contactDrawer.extraInfo")}
							</Typography>
							{contact?.extraInfo?.map(info => (
								<Paper
									key={info.id}
									square
									variant="outlined"
									className={classes.contactExtraInfo}
								>
									<InputLabel>{info.name}</InputLabel>
									<Typography component="div" noWrap style={{ paddingTop: 2 }}>
										<MarkdownWrapper>{info.value}</MarkdownWrapper>
									</Typography>
								</Paper>
							))}
						</Paper>
					</div>
				)}
			</Drawer>
			{openImageModal && (profilePic || contact?.profilePicUrl) && (
				<Dialog
					open={openImageModal}
					onClose={() => setOpenImageModal(false)}
					maxWidth="md"
					PaperProps={{
						style: {
							backgroundColor: "transparent",
							boxShadow: "none",
							overflow: "visible",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							margin: 16,
						}
					}}
					BackdropProps={{
						style: {
							backgroundColor: "rgba(0, 0, 0, 0.88)",
							backdropFilter: "blur(6px)",
						}
					}}
				>
					<div style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						position: "relative",
					}}>
						<div style={{
							width: "100%",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: 12,
							padding: "0 4px",
						}}>
							<Typography variant="h6" style={{ fontWeight: 600, color: "#ffffff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
								{contact?.name || "Foto de perfil"}
							</Typography>
							<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
								<Tooltip title="Actualizar foto en HD desde WhatsApp">
									<IconButton
										onClick={handleRefreshPic}
										disabled={loadingPic}
										style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.15)" }}
										size="small"
									>
										<SyncIcon fontSize="small" className={loadingPic ? classes.spin : ""} />
									</IconButton>
								</Tooltip>
								<Tooltip title="Descargar foto">
									<IconButton
										component="a"
										href={profilePic || contact.profilePicUrl}
										download={`${contact?.name || "perfil"}.jpg`}
										target="_blank"
										style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.15)" }}
										size="small"
									>
										<GetAppIcon fontSize="small" />
									</IconButton>
								</Tooltip>
								<IconButton
									onClick={() => setOpenImageModal(false)}
									style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.15)" }}
									size="small"
									title="Cerrar"
								>
									<CloseIcon fontSize="small" />
								</IconButton>
							</div>
						</div>

						<div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
							<img
								src={profilePic || contact.profilePicUrl}
								alt={contact?.name || "Foto de perfil"}
								style={{
									width: "min(88vw, 440px)",
									height: "min(88vw, 440px)",
									objectFit: "cover",
									borderRadius: "16px",
									boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
									border: "2px solid rgba(255, 255, 255, 0.2)",
									backgroundColor: "#111b21",
									filter: loadingPic ? "brightness(0.65)" : "none",
									transition: "filter 0.3s ease",
								}}
							/>
							{loadingPic && (
								<div style={{
									position: "absolute",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 8,
									backgroundColor: "rgba(0, 0, 0, 0.7)",
									padding: "12px 20px",
									borderRadius: "12px",
									backdropFilter: "blur(4px)",
								}}>
									<CircularProgress size={28} style={{ color: "#25d366" }} />
									<Typography variant="caption" style={{ color: "#ffffff", fontWeight: 500 }}>
										Obteniendo foto HD de WhatsApp...
									</Typography>
								</div>
							)}
						</div>
					</div>
				</Dialog>
			)}
		</>
	);
};

export default ContactDrawer;
