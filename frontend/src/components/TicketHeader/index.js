import React from "react";

import { Card } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		backgroundColor: theme.palette.tabHeaderBackground,
		flex: "none",
		flexShrink: 0,
		position: "sticky",
		top: 0,
		zIndex: 20,
		borderBottom: theme.palette.divider
			? `1px solid ${theme.palette.divider}`
			: "1px solid rgba(0, 0, 0, 0.12)",
		[theme.breakpoints.down("sm")]: {
			flexWrap: "wrap"
		}
	},
}));


const TicketHeader = ({ loading, children }) => {
	const classes = useStyles();

	return (
		<>
			{loading ? (
				<TicketHeaderSkeleton />
			) : (
				<Card square className={classes.ticketHeader}>
					{children}
				</Card>
			)}
		</>
	);
};

export default TicketHeader;
