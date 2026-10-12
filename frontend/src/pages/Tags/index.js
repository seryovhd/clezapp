import React, {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useContext,
} from "react";
import { toast } from "react-toastify";

import {
  makeStyles,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
} from "@material-ui/core";
import {
  Search as SearchIcon,
  DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon,
  OpenInNew as OpenInNewIcon
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TagModal from "../../components/TagModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useHistory } from "react-router-dom";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_TAGS": {
      const newTags = action.payload.filter(
        (tag) => !state.some((s) => s.id === tag.id)
      );
      return [...state, ...newTags];
    }
    case "UPDATE_TAGS": {
      const updated = action.payload;
      return state.map((s) => (s.id === updated.id ? updated : s));
    }
    case "DELETE_TAG":
      return state.filter((tag) => tag.id !== action.payload);
    case "RESET":
      return [];
    default:
      return state;
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    borderRadius: 12,
    backgroundColor: theme.palette.background.default,
    boxShadow: theme.shadows[1],
    ...theme.scrollbarStyles,
  },
  ticketTable: {
    marginTop: theme.spacing(3),
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[2],
  },
}));

const Tags = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [deletingTag, setDeletingTag] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [tags, dispatch] = useReducer(reducer, []);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [ticketsByTag, setTicketsByTag] = useState([]);
  const [activeTagId, setActiveTagId] = useState(null);

  const socketManager = useContext(SocketContext);
  const history = useHistory();

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await api.get("/tags/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_TAGS", payload: data.tags });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  }, [searchParam, pageNumber]);

  const handleClickTag = async (tagId) => {
    if (activeTagId === tagId) {
      setTicketsByTag([]);
      setActiveTagId(null);
      return;
    }
    try {
      const { data } = await api.get(`/tags/${tagId}/tickets`);
      setTicketsByTag(data);
      setActiveTagId(tagId);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchTags();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, fetchTags]);

  useEffect(() => {
    const socket = socketManager.getSocket(user.companyId);

    socket.on("user", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_TAGS", payload: data.tags });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_TAG", payload: +data.tagId });
      }
    });

    return () => socket.disconnect();
  }, [socketManager, user]);

  const handleOpenTagModal = () => setTagModalOpen(true);
  const handleCloseTagModal = () => setTagModalOpen(false);

  const handleSearch = (e) => setSearchParam(e.target.value.toLowerCase());

  const handleEditTag = (tag) => {
    setSelectedTag(tag);
    setTagModalOpen(true);
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await api.delete(`/tags/${tagId}`);
      toast.success(i18n.t("tags.toasts.deleted"));
      dispatch({ type: "RESET" });
      setPageNumber(1);
      await fetchTags();
    } catch (err) {
      toastError(err);
    }
    setDeletingTag(null);
    setConfirmModalOpen(false);
  };

  const loadMore = () => setPageNumber((prev) => prev + 1);

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) loadMore();
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={deletingTag && i18n.t("tags.confirmationModal.deleteTitle")}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteTag(deletingTag.id)}
      >
        {i18n.t("tags.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <TagModal
        open={tagModalOpen}
        onClose={handleCloseTagModal}
        reload={fetchTags}
        aria-labelledby="form-dialog-title"
        tagId={selectedTag && selectedTag.id}
      />

      <MainHeader>
        <Title>{i18n.t("tags.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            variant="outlined"
            size="small"
            style={{ marginRight: 12 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenTagModal}
          >
            {i18n.t("tags.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} onScroll={handleScroll}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">{i18n.t("tags.table.name")}</TableCell>
              <TableCell align="center">{i18n.t("tags.table.tickets")}</TableCell>
              <TableCell align="center">{i18n.t("tags.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tags.map((tag) => (
              <TableRow key={tag.id} hover>
                <TableCell align="center">
                  <Chip
                    clickable
                    onClick={() => handleClickTag(tag.id)}
                    style={{
                      backgroundColor: tag.color,
                      color: "#fff",
                      fontWeight: "bold",
                      textShadow: "0 1px 2px #000",
                    }}
                    label={tag.name.toUpperCase()}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">{tag.ticketsCount}</TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => handleEditTag(tag)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setConfirmModalOpen(true);
                      setDeletingTag(tag);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {loading && <TableRowSkeleton columns={4} />}
          </TableBody>
        </Table>
      </Paper>

      {ticketsByTag.length > 0 && (
        <Paper className={classes.ticketTable}>
          <Title>Tickets con este tag</Title>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Contacto</TableCell>
                <TableCell>Número</TableCell>
                <TableCell>Último mensaje</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ticketsByTag.map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell>{ticket.contact?.name || "-"}</TableCell>
                  <TableCell>{ticket.contact?.number || "-"}</TableCell>
                  <TableCell>{ticket.lastMessage || "-"}</TableCell>
                  <TableCell>
                    <a
                      href={`/tickets/${ticket.uuid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      <Button
                        size="small"
                        color="primary"
                        variant="outlined"
                        startIcon={<OpenInNewIcon />}
                      >
                        Abrir
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </MainContainer>
  );
};

export default Tags;
