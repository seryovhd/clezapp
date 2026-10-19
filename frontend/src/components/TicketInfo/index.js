import React, { useState, useEffect } from "react";

import { Avatar, CardHeader } from "@material-ui/core";
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

	const phoneNumber = contact?.number || ticket?.contact?.number || "";

	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ component: "div" }}
			avatar={
				<AvatarWithPreview
					contact={contact || ticket?.contact}
					src={contact?.profilePicUrl}
					style={{ backgroundColor: generateColor(contact?.number), color: "white", fontWeight: "bold" }}
					alt="contact_image"
				>
					{getInitials(contact?.name)}
				</AvatarWithPreview>
			}
			title={`${contactName || contact?.name || ""} #${ticket?.id || ""}`}
			subheader={
				<div style={{ display: "flex", flexDirection: "column", marginTop: 2 }}>
					{phoneNumber && !ticket?.isGroup && (
						<div
							style={{
								display: "inline-flex",
								alignItems: "center",
								width: "fit-content",
								backgroundColor: isDark ? "rgba(37, 211, 102, 0.12)" : "rgba(0, 128, 105, 0.08)",
								border: `1px solid ${isDark ? "rgba(37, 211, 102, 0.32)" : "rgba(0, 128, 105, 0.22)"}`,
								borderRadius: 12,
								padding: "1px 8px",
								marginTop: 2,
								marginBottom: ticket?.user && userName ? 2 : 0,
								fontSize: "0.82rem",
								fontWeight: 700,
								color: isDark ? "#25D366" : "#008069",
								letterSpacing: "0.4px",
								lineHeight: 1.4,
								boxShadow: isDark ? "0 0 8px rgba(37, 211, 102, 0.15)" : "none",
								transition: "all 0.2s ease",
							}}
						>
							<span>{phoneNumber}</span>
							<CopyNumberButton
								number={phoneNumber}
								size={13}
								style={{ color: isDark ? "#25D366" : "#008069", opacity: 0.9 }}
							/>
						</div>
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

