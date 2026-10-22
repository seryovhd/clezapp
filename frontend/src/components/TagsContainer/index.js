import { Chip, Paper, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const CustomPaperComponent = ({ children, ...other }) => (
  <Paper style={{ width: 400, marginLeft: 12 }} {...other}>
    {children}
  </Paper>
);

export function TagsContainer({ ticket }) {
  const [tags, setTags] = useState([]);
  const [selecteds, setSelecteds] = useState([]);
  const isMounted = useRef(true);
  const inputRef = useRef(null);
  const isInputFocused = useRef(false);

  const keepFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    if (Array.isArray(ticket?.tags)) {
      setSelecteds((prev) => {
        const prevIds = (prev || []).map((t) => t.id).sort().join(",");
        const newIds = ticket.tags.map((t) => t.id).sort().join(",");
        if (prevIds === newIds) return prev;
        return ticket.tags;
      });
      if (isInputFocused.current) {
        keepFocus();
      }
    } else {
      setSelecteds([]);
    }
  }, [ticket?.tags, keepFocus]);

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

    // Mantener foco activo ininterrumpido en el campo de texto
    isInputFocused.current = true;
    keepFocus();
    setTimeout(keepFocus, 30);
    setTimeout(keepFocus, 100);

    await syncTags({ ticketId: ticket.id, tags: optionsChanged });

    if (isInputFocused.current) {
      keepFocus();
    }
  };

  return (
    <Paper>
      <Autocomplete
        multiple
        size="small"
        options={tags}
        value={selecteds}
        freeSolo
        blurOnSelect={false}
        onChange={(e, v, r) => onChange(v, r)}
        getOptionLabel={(option) => option.name}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              key={option.id || index}
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
          <TextField
            {...params}
            inputRef={inputRef}
            variant="outlined"
            placeholder="Tags"
            onFocus={() => {
              isInputFocused.current = true;
            }}
            onBlur={() => {
              setTimeout(() => {
                if (document.activeElement !== inputRef.current) {
                  isInputFocused.current = false;
                }
              }, 200);
            }}
          />
        )}
        PaperComponent={CustomPaperComponent}
      />
    </Paper>
  );
}
