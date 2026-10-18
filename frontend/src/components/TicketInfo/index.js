import React, { useState, useEffect } from "react";

import { Avatar, CardHeader } from "@material-ui/core";
import { getInitials } from "../../helpers/getInitials";
import { generateColor } from "../../helpers/colorGenerator";
import { i18n } from "../../translate/i18n";

const TicketInfo = ({ contact, ticket, onClick }) => {
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
				<Avatar
					style={{ backgroundColor: generateColor(contact?.number), color: "white", fontWeight: "bold" }}
					src={contact?.profilePicUrl}
					alt="contact_image"
				>
					{getInitials(contact?.name)}
				</Avatar>
			}
			title={`${contactName || contact?.name || ""} #${ticket?.id || ""}`}
			subheader={
				<div style={{ display: "flex", flexDirection: "column", marginTop: 2 }}>
					{phoneNumber && !ticket?.isGroup && (
						<span style={{ fontSize: "0.82rem", color: "inherit", opacity: 0.85, fontWeight: 500, lineHeight: 1.3 }}>
							{phoneNumber}
						</span>
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

