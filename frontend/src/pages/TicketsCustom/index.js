import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		padding: theme.spacing(0),
		height: `calc(100% - 54px)`,
		overflowY: "hidden",
	},

	chatPapper: {
		display: "flex",
		height: "100%",
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		overflowX: "hidden",
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		backgroundColor: theme.palette.boxticket,
		display: "flex",
		justifyContent: "space-evenly",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
	},
}));

const TicketsCustom = () => {
	const theme = useTheme();
	const [logoImg, setLogoImg] = useState(
		theme.palette.type === "light"
			? `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/interno.png`
			: `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/logo_w.png`
	);

	useEffect(() => {
		setLogoImg(
			theme.palette.type === "light"
				? `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/interno.png`
				: `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/logo_w.png`
		);
	}, [theme.palette.type]);

	const classes = useStyles();
	const { ticketId } = useParams();

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<Grid container spacing={0}>
					<Grid item xs={4} className={classes.contactsWrapper}>
						<TicketsManager />
					</Grid>
					<Grid item xs={8} className={classes.messagesWrapper}>
						{ticketId ? (
							<>
								<Ticket />
							</>
						) : (
							<Paper square variant="outlined" className={classes.welcomeMsg}>
								<div>
									<center>
										<img
											style={{ margin: "0 auto", width: "30%" }}
											src={logoImg}
											alt={`${process.env.REACT_APP_NAME_SYSTEM}`}
										/>
									</center>
								</div>
								{/* <span>{i18n.t("chat.noTicketMessage")}</span> */}
							</Paper>
						)}
					</Grid>
				</Grid>
			</div>
		</div>
	);
};

export default TicketsCustom;
