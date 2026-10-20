import React, { useState, useEffect } from "react";

import { Avatar, CardHeader, Tooltip } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";
import { i18n } from "../../translate/i18n";
import CopyNumberButton from "../CopyNumberButton";
import { AvatarWithPreview } from "../ProfilePicModal";

const TicketInfo = ({ contact, ticket, onClick }) => {
	const theme = useTheme();
	const isDark = (theme.palette?.type || theme.mode) === "dark";
	const { user } = ticket || {};
	const [userName, setUserName] = useState('');
	const [contactName, setContactName] = useState('');

	useEffect(() => {
		if (contact) {
			let name = contact.name || contact.number || "";
			if (document.body.offsetWidth < 600) {
				if (name.length > 10) {
					name = name.substring(0, 10) + '...';
				}
			}
			setContactName(name);
		}

		if (user && user.name) {
			setUserName(`${i18n.t("messagesList.header.assignedTo")} ${user.name}`);

			if (document.body.offsetWidth < 600) {
				setUserName(`${user.name}`);
			}
		} else {
			setUserName('');
		}
	}, [contact, user]);

	const currentContact = contact || ticket?.contact;
	const phoneNumber = currentContact?.number || "";
	const rawNumber = String(phoneNumber || "").trim();
	const cleanDigits = rawNumber.replace(/\D/g, "");
	const contactLid = currentContact?.lid ? String(currentContact.lid).replace(/@.*$/, "").replace(/\D/g, "") : "";

	const isLid = Boolean(
		rawNumber.includes("@lid") ||
		(contactLid && cleanDigits === contactLid) ||
		cleanDigits.length >= 15
	);

	const badgeColor = isLid
		? (isDark ? "#ff5252" : "#c62828")
		: (isDark ? "#25D366" : "#008069");

	const badgeBg = isLid
		? (isDark ? "rgba(255, 82, 82, 0.14)" : "rgba(211, 47, 47, 0.08)")
		: (isDark ? "rgba(37, 211, 102, 0.12)" : "rgba(0, 128, 105, 0.08)");

	const badgeBorder = isLid
		? (isDark ? "1px solid rgba(255, 82, 82, 0.4)" : "1px solid rgba(211, 47, 47, 0.3)")
		: (isDark ? "1px solid rgba(37, 211, 102, 0.32)" : "1px solid rgba(0, 128, 105, 0.22)");

	const badgeGlow = isDark
		? (isLid ? "0 0 8px rgba(255, 82, 82, 0.22)" : "0 0 8px rgba(37, 211, 102, 0.15)")
		: "none";

	const tooltipTitle = isLid
		? "⚠️ Identificador LID de WhatsApp - Número telefónico no actualizado"
		: "Número de WhatsApp";

	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ component: "div" }}
			avatar={
				<AvatarWithPreview
					contact={currentContact}
					src={currentContact?.profilePicUrl}
					style={{ backgroundColor: generateColor(currentContact?.number), color: "white", fontWeight: "bold" }}
					alt={contactName || currentContact?.name || "Foto de contacto"}
					title={contactName || currentContact?.name || "Foto de contacto"}
				>
					{getInitials(currentContact?.name)}
				</AvatarWithPreview>
			}
			title={`${contactName || currentContact?.name || ""} #${ticket?.id || ""}`}
			subheader={
				<div style={{ display: "flex", flexDirection: "column", marginTop: 2 }}>
					{phoneNumber && !ticket?.isGroup && (
						<Tooltip title={tooltipTitle} arrow>
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									width: "fit-content",
									backgroundColor: badgeBg,
									border: badgeBorder,
									borderRadius: 12,
									padding: "1px 8px",
									marginTop: 2,
									marginBottom: ticket?.user && userName ? 2 : 0,
									fontSize: "0.82rem",
									fontWeight: 700,
									color: badgeColor,
									letterSpacing: "0.4px",
									lineHeight: 1.4,
									boxShadow: badgeGlow,
									transition: "all 0.2s ease",
								}}
							>
								{isLid && (
									<span
										style={{
											fontSize: "0.75rem",
											marginRight: 4,
											display: "inline-flex",
											alignItems: "center",
										}}
									>
										⚠️
									</span>
								)}
								<span>{phoneNumber}</span>
								<CopyNumberButton
									number={phoneNumber}
									size={13}
									style={{ color: badgeColor, opacity: 0.9 }}
								/>
							</div>
						</Tooltip>
					)}
					{ticket?.user && userName ? (
						<span style={{ fontSize: "0.75rem", color: "inherit", opacity: 0.65, lineHeight: 1.3, marginTop: phoneNumber && !ticket?.isGroup ? 1 : 0 }}>
							{userName}
						</span>
					) : null}
				</div>
			}
		/>
	);
};

export default TicketInfo;

