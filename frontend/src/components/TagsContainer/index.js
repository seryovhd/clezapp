import { Chip, Paper, TextField } from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import React, { useEffect, useRef, useState } from "react";
import { isArray, isString } from "lodash";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const CustomPaper = (props) => (
  <Paper
    {...props}
    style={{ width: 400, marginLeft: 12, ...props.style }}
    onMouseDown={(e) => {
      // Evitar que el clic en cualquier parte del menú (scrollbar, bordes, padding) desenfoque el input
      e.preventDefault();
    }}
  />
);

export function TagsContainer({ ticket }) {
  const [tags, setTags] = useState([]);
  const [selecteds, setSelecteds] = useState([]);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const isMounted = useRef(true);
  const tagInputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    loadTags();
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Sincronizar tags solo cuando cambia el ticketId
  useEffect(() => {
    if (Array.isArray(ticket?.tags)) {
      const sorted = [...ticket.tags].sort((a, b) =>
        (a?.name || "").toLowerCase().localeCompare((b?.name || "").toLowerCase())
      );
      setSelecteds(sorted);
    } else {
      setSelecteds([]);
    }
  }, [ticket?.id]);

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
      if (isMounted.current) {
        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) => (a?.name || "").toLowerCase().localeCompare((b?.name || "").toLowerCase()))
          : [];
        setTags(sorted);
      }
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

  const focusInput = () => {
    if (tagInputRef.current) {
      tagInputRef.current.focus();
    }
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }, 0);
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }, 50);
  };

  const onChange = async (event, value, reason) => {
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
      optionsChanged = value || [];
    }

    const sorted = [...optionsChanged].sort((a, b) =>
      (a?.name || "").toLowerCase().localeCompare((b?.name || "").toLowerCase())
    );

    if (isMounted.current) {
      setSelecteds(sorted);
      setInputValue("");
      setOpen(true);
    }

    // ⚡ Optimistic UI: actualización a 0 ms para la lista lateral de tickets
    window.dispatchEvent(
      new CustomEvent("ticket-optimistic-update", {
        detail: {
          type: "tags",
          ticketId: ticket.id,
          tags: sorted
        }
      })
    );

    // Mantener siempre el foco activo en el input de inmediato
    focusInput();

    await syncTags({ ticketId: ticket.id, tags: sorted });
  };

  return (
    <Paper ref={containerRef} style={{ boxShadow: "none" }}>
      <Autocomplete
        multiple
        size="small"
        options={tags}
        value={selecteds}
        freeSolo
        autoHighlight
        openOnFocus
        filterSelectedOptions
        disableCloseOnSelect
        blurOnSelect={false}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={(event, reason) => {
          if (reason === "select-option" || reason === "remove-option") {
            return;
          }
          if (containerRef.current && containerRef.current.contains(document.activeElement)) {
            return;
          }
          setOpen(false);
        }}
        inputValue={inputValue}
        onInputChange={(event, newInputValue, reason) => {
          if (reason === "input") {
            setInputValue(newInputValue);
          } else if (reason === "clear" || reason === "reset") {
            setInputValue("");
          }
        }}
        getOptionSelected={(option, value) =>
          Number(option?.id) === Number(value?.id) ||
          (option?.name && value?.name && option.name.toLowerCase() === value.name.toLowerCase())
        }
        getOptionLabel={(option) => (isString(option) ? option : option?.name || "")}
        onChange={(e, v, r) => onChange(e, v, r)}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { onDelete, ...chipProps } = getTagProps({ index });
            return (
              <Chip
                key={`tag-chip-${option.id || option.name}-${index}`}
                variant="outlined"
                style={{
                  background: option.color || "#eee",
                  color: "#FFF",
                  marginRight: 2,
                  fontWeight: 600,
                  borderRadius: 30,
                  fontSize: "0.8em",
                  whiteSpace: "nowrap"
                }}
                label={(isString(option) ? option : option?.name || "").toUpperCase()}
                onMouseDown={(e) => {
                  // Prevenir que el clic en el chip o en la (X) robe el foco al input
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDelete={(e) => {
                  if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  onDelete(e);
                  focusInput();
                }}
                {...chipProps}
                size="small"
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={(el) => {
              tagInputRef.current = el;
              if (params.inputProps?.ref) {
                if (typeof params.inputProps.ref === "function") {
                  params.inputProps.ref(el);
                } else {
                  params.inputProps.ref.current = el;
                }
              }
            }}
            variant="outlined"
            placeholder="Tags"
            onClick={() => {
              setOpen(true);
              focusInput();
            }}
          />
        )}
        PaperComponent={CustomPaper}
      />
    </Paper>
  );
}
