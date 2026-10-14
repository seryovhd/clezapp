import React, { useEffect, useReducer, useState, useContext } from "react";
import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import QueueModal from "../../components/QueueModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { SocketContext } from "../../context/Socket/SocketContext";

const useStyles = makeStyles((theme) => {
  const isDark = (theme.palette?.type || theme.mode) === "dark";
  return {
    mainPaper: {
      flex: 1,
      padding: theme.spacing(1.5),
      overflowY: "scroll",
      borderRadius: 12,
      backgroundColor: isDark ? "#111b21" : "#ffffff",
      border: isDark ? "1px solid #222d34" : "1px solid #e9edef",
      boxShadow: isDark
        ? "0 2px 8px rgba(0,0,0,0.3)"
        : "0 2px 8px rgba(0,0,0,0.05)",
      ...theme.scrollbarStyles,
    },
    tableContainer: {
      borderRadius: 8,
      overflow: "hidden",
    },
    tableHeadRow: {
      backgroundColor: isDark ? "#1f2c34" : "#f0f2f5",
      "& th": {
        color: isDark ? "#00a884" : "#008069",
        fontWeight: 700,
        fontSize: "0.85rem",
        borderBottom: isDark ? "2px solid #222d34" : "2px solid #e9edef",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "12px 16px",
      },
    },
    rowBase: {
      backgroundColor: "transparent",
      transition: "background-color 0.15s ease",
      "&:hover": {
        backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
      },
      "& td": {
        color: isDark ? "#e9edef" : "#111b21",
        borderColor: isDark ? "#222d34" : "#e9edef",
        fontSize: "0.9rem",
        padding: "10px 16px",
      },
    },
    rowZebra: {
      backgroundColor: isDark ? "#182229" : "#f8f9fa",
      transition: "background-color 0.15s ease",
      "&:hover": {
        backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      },
      "& td": {
        color: isDark ? "#e9edef" : "#111b21",
        borderColor: isDark ? "#222d34" : "#e9edef",
        fontSize: "0.9rem",
        padding: "10px 16px",
      },
    },
    queueName: {
      fontWeight: 600,
      color: isDark ? "#e9edef" : "#111b21",
    },
    colorBadge: {
      width: 52,
      height: 20,
      display: "inline-block",
      borderRadius: 6,
      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
      border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.1)",
    },
    greetingText: {
      maxWidth: 320,
      color: isDark ? "#8696a0" : "#54656f",
    },
    editButton: {
      color: isDark ? "#aebac1" : "#54656f",
      marginRight: theme.spacing(0.5),
      transition: "color 0.2s, background-color 0.2s, transform 0.15s",
      "&:hover": {
        color: isDark ? "#00a884" : "#008069",
        backgroundColor: isDark ? "rgba(0, 168, 132, 0.12)" : "rgba(0, 128, 105, 0.08)",
        transform: "scale(1.1)",
      },
    },
    deleteButton: {
      color: isDark ? "#aebac1" : "#54656f",
      transition: "color 0.2s, background-color 0.2s, transform 0.15s",
      "&:hover": {
        color: "#f15c6d",
        backgroundColor: "rgba(241, 92, 109, 0.12)",
        transform: "scale(1.1)",
      },
    },
  };
});

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_QUEUES":
      const newQueues = [];
      action.payload.forEach((queue) => {
        const index = state.findIndex((q) => q.id === queue.id);
        if (index !== -1) {
          state[index] = queue;
        } else {
          newQueues.push(queue);
        }
      });
      return [...state, ...newQueues];

    case "UPDATE_QUEUES":
      const queue = action.payload;
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
        return [...state];
      } else {
        return [queue, ...state];
      }

    case "DELETE_QUEUE":
      return state.filter((q) => q.id !== action.payload);

    case "RESET":
      return [];

    default:
      return state;
  }
};

const Queues = () => {
  const classes = useStyles();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const socketManager = useContext(SocketContext);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on(`company-${companyId}-queue`, (data) => {
      if (["create", "update"].includes(data.action)) {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    });

    return () => socket.disconnect();
  }, [socketManager]);

  const handleOpenQueueModal = () => {
    setQueueModalOpen(true);
    setSelectedQueue(null);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success(i18n.t("¡Fila eliminada con éxito!"));
    } catch (err) {
      toastError(err);
    }
    setSelectedQueue(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${selectedQueue.name}?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
      />

      <MainHeader>
        <Title>{i18n.t("queues.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenQueueModal}
            style={{ borderRadius: 20, padding: "6px 16px", fontWeight: "bold" }}
          >
            {i18n.t("queues.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small" className={classes.tableContainer}>
          <TableHead>
            <TableRow className={classes.tableHeadRow}>
              <TableCell align="center">
                {i18n.t("queues.table.name")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.color")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.greeting")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {queues.map((queue, index) => (
              <TableRow
                key={queue.id}
                className={index % 2 !== 0 ? classes.rowZebra : classes.rowBase}
              >
                <TableCell align="center">
                  <span className={classes.queueName}>{queue.name}</span>
                </TableCell>

                <TableCell align="center">
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%"
                  }}>
                    <span
                      className={classes.colorBadge}
                      style={{ backgroundColor: queue.color }}
                    />
                  </div>
                </TableCell>

                <TableCell align="center">
                  <Typography
                    className={classes.greetingText}
                    noWrap
                    variant="body2"
                    style={{ margin: "0 auto" }}
                  >
                    {queue.greetingMessage || "—"}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <IconButton
                    size="small"
                    className={classes.editButton}
                    onClick={() => handleEditQueue(queue)}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    className={classes.deleteButton}
                    onClick={() => {
                      setSelectedQueue(queue);
                      setConfirmModalOpen(true);
                    }}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={4} />}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Queues;
