import { Chip, Paper, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

export function TagsContainer({ ticket }) {
  const [tags, setTags] = useState([]);
  const [selecteds, setSelecteds] = useState([]);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchTags = async () => {
      await loadTags();
      if (!isMounted.current) return;

      if (Array.isArray(ticket.tags)) {
        setSelecteds(ticket.tags);
      } else {
        setSelecteds([]);
      }
    };

    fetchTags();
  }, [ticket]);

  const createTag = async (data) => {
    try {
      const { data: responseData } = await api.post(`/tags`, data);
      return responseData;
    } catch (err) {
      if (isMounted.current) toastError(err);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get(`/tags/list`);
      if (isMounted.current) setTags(data);
    } catch (err) {
      if (isMounted.current) toastError(err);
    }
  };

  const syncTags = async (data) => {
    try {
      const { data: responseData } = await api.post(`/tags/sync`, data);
      return responseData;
    } catch (err) {
      if (isMounted.current) toastError(err);
    }
  };

  const onChange = async (value, reason) => {
    let optionsChanged = [];

    if (reason === "create-option") {
      if (isArray(value)) {
        for (let item of value) {
          if (isString(item)) {
            const newTag = await createTag({ name: item });
            if (newTag) optionsChanged.push(newTag);
          } else {
            optionsChanged.push(item);
          }
        }
      }
      await loadTags();
    } else {
      optionsChanged = value;
    }

    if (isMounted.current) {
      setSelecteds(optionsChanged);
    }

    await syncTags({ ticketId: ticket.id, tags: optionsChanged });
  };

  return (
    <Paper>
      <Autocomplete
        multiple
        size="small"
        options={tags}
        value={selecteds}
        freeSolo
        onChange={(e, v, r) => onChange(v, r)}
        getOptionLabel={(option) => option.name}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant="outlined"
              style={{
                background: option.color || "#eee",
                color: "#FFF",
                marginRight: 1,
                fontWeight: 600,
                borderRadius: 30,
                fontSize: "0.8em",
                whiteSpace: "nowrap"
              }}
              label={option.name.toUpperCase()}
              {...getTagProps({ index })}
              size="small"
            />
          ))
        }
        renderInput={(params) => (
          <TextField {...params} variant="outlined" placeholder="Tags" />
        )}
        PaperComponent={({ children }) => (
          <Paper style={{ width: 400, marginLeft: 12 }}>{children}</Paper>
        )}
      />
    </Paper>
  );
}
