// TicketActionButtonsCustom.js
import React, { useContext, useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
	makeStyles,
	ButtonGroup,
	Button,
	Menu,
	MenuItem,
	ThemeProvider,
	createTheme
} from "@material-ui/core";
import {
	Replay,
	ArrowDropDown,
	DeleteOutline,
	Schedule,
	CompareArrows,
	AccessTime,
	UndoRounded
} from "@material-ui/icons";
import { useTheme } from "@material-ui/core/styles";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import UndoRoundedIcon from "@material-ui/icons/UndoRounded";
import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import ScheduleModal from "../ScheduleModal";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles(theme => ({
	actionButtons: {
		marginRight: 6,
		flex: "none",
		alignSelf: "center",
		marginLeft: "auto",
		"& > *": {
			margin: theme.spacing(0.5),
		},
	},
	resolverGroup: {
		borderRadius: 16,
	},
	resolverButton: {
		fontWeight: "bold",
		textTransform: "uppercase"
	},
	deleteItem: {
		color: "#f44336",
		fontWeight: 500,
		display: "flex",
		alignItems: "center",
	}
}));

const TicketActionButtonsCustom = ({ ticket, handleClose }) => {
	const classes = useStyles();
	const history = useHistory();
	const [menuAnchor, setMenuAnchor] = useState(null);
	const [loading, setLoading] = useState(false);
	const { user } = useContext(AuthContext);
	const { setCurrentTicket } = useContext(TicketsContext);
	const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
	const [contactId, setContactId] = useState(null);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const isMounted = useRef(true);
	const customTheme = createTheme({
		palette: {
			primary: green,
		}
	});

	const handleUpdateTicketStatus = async (e, status, userId) => {
		// ⚡ Optimistic UI: actualización inmediata a 0 ms para la interfaz
		window.dispatchEvent(
			new CustomEvent("ticket-optimistic-update", {
				detail: {
					type: "status",
					ticketId: ticket.id,
					status: status,
					userId: userId,
					ticket: { ...ticket, status: status, userId: userId }
				}
			})
		);

		if (status !== "open") {
			setCurrentTicket({ id: null, code: null });
			history.push("/tickets");
		} else {
			setCurrentTicket({ ...ticket, code: "#open" });
		}

		setLoading(true);
		try {
			await api.put(`/tickets/${ticket.id}`, {
				status: status,
				userId: userId || null,
				useIntegration: status === "closed" ? false : ticket.useIntegration,
				promptId: status === "closed" ? false : ticket.promptId,
				integrationId: status === "closed" ? false : ticket.integrationId,
				flowStopped: status === "closed" ? null : ticket.flowStopped,
				flowWebhook: status === "closed" ? false : ticket.flowWebhook
			});

			setLoading(false);
		} catch (err) {
			setLoading(false);
			// Rollback si la red falló
			window.dispatchEvent(
				new CustomEvent("ticket-optimistic-update", {
					detail: {
						type: "rollback",
						ticket: ticket
					}
				})
			);
			toastError(err);
		}
	};

	const handleExtraOption = (option) => {
		setMenuAnchor(null);
		switch (option) {
			case "resolver_sin_despedida":
				return;
			case "devolver":
				handleUpdateTicketStatus(null, "pending", null);
				return;
			case "transferir":
				setTransferTicketModalOpen(true);
				return;
			case "posponer":
				setContactId(ticket.contact.id);
				setScheduleModalOpen(true);
				return;
			case "eliminar":
				setConfirmationOpen(true);
				return;
			default:
				return;
		}
	};

	const handleDeleteTicket = async () => {
		try {
			await api.delete(`/tickets/${ticket.id}`);
			setConfirmationOpen(false);
			history.push("/tickets");
		} catch (err) {
			setConfirmationOpen(false);
			toastError(err);
		}
	};

	const handleCloseTransferTicketModal = () => {
		if (isMounted.current) {
			setTransferTicketModalOpen(false);
		}
	};
	const handleCloseScheduleModal = () => {
		setScheduleModalOpen(false);
		setContactId(null);
	};
	const theme = useTheme();
	return (
		<div className={classes.actionButtons}>
			{ticket.status === "closed" && (
				<ButtonWithSpinner
					loading={loading}
					startIcon={<Replay />}
					size="small"
					onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.reopen")}
				</ButtonWithSpinner>
			)}

			{ticket.status === "open" && (
				<>
					<ThemeProvider theme={customTheme}>
						<ButtonGroup
							variant="contained"
							color="default"
							size="small"
							className={classes.resolverGroup}
							style={{
								boxShadow: "0px 3px 8px rgba(0, 0, 0, 0.2)",
								borderRadius: 20,
								overflow: "hidden"
							}}
						>
							<Button
								className={classes.resolverButton}
								onClick={() => handleUpdateTicketStatus(null, "closed", user?.id)}
								startIcon={<CheckCircleIcon />}
								style={{
									borderRadius: 0,
									fontWeight: "bold",
									textTransform: "uppercase",
									padding: "6px 16px",
									backgroundColor: theme.palette.type === 'dark' ? '#333333' : '#0077e3',
									color: "#fff",
								}}
							>
								{i18n.t("messagesList.header.buttons.resolve")}
							</Button>
							<Button
								color="primary"
								onClick={(e) => setMenuAnchor(e.currentTarget)}
								style={{
									backgroundColor: theme.palette.type === 'dark' ? '#333333' : '#0077e3',
									color: "#fff",
									borderLeft: "1px solid rgba(255, 255, 255, 0.2)"
								}}
							>
								<ArrowDropDown />
							</Button>
						</ButtonGroup>
					</ThemeProvider>

					<Menu
						anchorEl={menuAnchor}
						keepMounted
						open={Boolean(menuAnchor)}
						onClose={() => setMenuAnchor(null)}
						anchorOrigin={{
							vertical: "bottom",
							horizontal: "left",
						}}
						transformOrigin={{
							vertical: "top",
							horizontal: "left",
						}}
						style={{ top: 45 }}
					>
						<MenuItem onClick={() => handleExtraOption("devolver")} style={{ marginRight: 15, marginLeft: 15 }}>
							<UndoRoundedIcon fontSize="small" style={{ marginRight: 12 }} />
							Devolver
						</MenuItem>
						<MenuItem onClick={() => handleExtraOption("transferir")} style={{ marginRight: 15, marginLeft: 15 }}>
							<CompareArrows fontSize="small" style={{ marginRight: 8 }} />
							Transferir
						</MenuItem>
						<MenuItem onClick={() => handleExtraOption("posponer")} style={{ marginRight: 15, marginLeft: 15 }}>
							<AccessTime fontSize="small" style={{ marginRight: 8 }} />
							Posponer
						</MenuItem>
						<MenuItem
							onClick={() => handleExtraOption("eliminar")}
							className={classes.deleteItem}
							style={{ marginRight: 15, marginLeft: 15 }}
						>
							<DeleteOutline fontSize="small" style={{ marginRight: 8 }} />
							Eliminar
						</MenuItem>
					</Menu>

					<TransferTicketModalCustom
						modalOpen={transferTicketModalOpen}
						onClose={handleCloseTransferTicketModal}
						ticketid={ticket.id}
					/>
					<ScheduleModal
						open={scheduleModalOpen}
						onClose={handleCloseScheduleModal}
						aria-labelledby="form-dialog-title"
						contactId={contactId}
					/>
					<ConfirmationModal
						title={`${i18n.t("ticketOptionsMenu.confirmationModal.titleFrom")} ${ticket.contact.name}?`}
						open={confirmationOpen}
						onClose={setConfirmationOpen}
						onConfirm={handleDeleteTicket}
					>
						{i18n.t("ticketOptionsMenu.confirmationModal.message")}
					</ConfirmationModal>
				</>
			)
			}

			{
				ticket.status === "pending" && (
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.accept")}
					</ButtonWithSpinner>
				)
			}
		</div >
	);
};

export default TicketActionButtonsCustom;
