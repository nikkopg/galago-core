// A thin pointer shell over wellGeometry (07-02). Every decision (what to draw,
// what the status line says, whether "Edit as fields" is forced open, which
// patch a gesture produces) comes from buildWellPickerView and the patch
// producers; this file only forwards pointer positions to them. The one output
// is onPatch. Nothing is written on mount, on a plate or list change, on hover
// or on scroll: a patch exists only for an operator drag, a fitting destination
// click or "Clear selection" (D-13). The typed fields come from the host through
// renderField, so number, text and variable-picker behaviour is inherited.
// Hit-testing is arithmetic over the inner grid's bounding box (D-10).

import { useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ReactNode } from "react";
import {
  Box,
  Button,
  Collapse,
  Flex,
  HStack,
  SimpleGrid,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronRightIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { useToolOptions } from "@/hooks/useToolOptions";
import { plateListInput } from "@/components/tools/fieldOptions";
import {
  CLEAR_PATCH,
  CLEAR_SELECTION_LABEL,
  DEST_PLATE_TITLE,
  EDIT_AS_FIELDS_LABEL,
  SOURCE_PLATE_TITLE,
  WELL_FIELDS,
  buildWellPickerView,
  cellFromPoint,
  destClickPatch,
  dragRect,
  rowLabel,
  sourcePatch,
} from "@/components/tools/wellGeometry";
import type {
  Cell,
  GridMetrics,
  GridSide,
  PlateListInput,
  PlateSize,
  Rect,
  WellField,
} from "@/components/tools/wellGeometry";

export interface WellPickerProps {
  plates: PlateListInput;
  values: Record<string, unknown>;
  allowVariables: boolean;
  fieldsLayout: "grid" | "rows";
  renderField: (name: WellField) => ReactNode;
  onPatch: (patch: Record<string, string | number>) => void;
}

type WellState = "empty" | "sel" | "ghost" | "put" | "bad";

const inRect = (r: number, c: number, rect: Rect | undefined): boolean =>
  rect !== undefined && r >= rect.r && r < rect.r + rect.h && c >= rect.c && c < rect.c + rect.w;

const sameRect = (a: Rect | undefined, b: Rect): boolean =>
  a !== undefined && a.r === b.r && a.c === b.c && a.h === b.h && a.w === b.w;

interface WellGridProps {
  label: string;
  describedBy: string;
  size: PlateSize;
  metrics: GridMetrics;
  // The state to draw for a well, decided by the view model.
  stateAt: (r: number, c: number) => WellState;
  notAllowed: boolean;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>, cell: Cell | undefined) => void;
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>, cell: Cell | undefined) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: () => void;
  onLostPointerCapture?: () => void;
  onPointerLeave?: () => void;
  onClick?: (cell: Cell | undefined) => void;
  // true for the source (a drag clamps to the edge); false for the destination.
  clamp: boolean;
}

function WellGrid({
  label,
  describedBy,
  size,
  metrics,
  stateAt,
  notAllowed,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onPointerLeave,
  onClick,
  clamp,
}: WellGridProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  const mutedText = useColorModeValue("gray.600", "whiteAlpha.700");
  const emptyBorder = useColorModeValue("blackAlpha.300", "whiteAlpha.400");
  const selFill = "#85B7EB";
  const selBorder = "#185FA5";
  const ghostFill = useColorModeValue("#E1F5EE", "rgba(29,158,117,0.25)");
  const ghostBorder = "#1D9E75";
  const putFill = "#5DCAA5";
  const putBorder = "#0F6E56";
  const badFill = useColorModeValue("#FCEBEB", "rgba(240,149,149,0.2)");
  const badBorder = useColorModeValue("#A32D2D", "#F09595");

  const styleFor = (state: WellState) => {
    switch (state) {
      case "sel":
        return { bg: selFill, borderColor: selBorder, borderStyle: "solid" };
      case "ghost":
        return { bg: ghostFill, borderColor: ghostBorder, borderStyle: "dashed" };
      case "put":
        return { bg: putFill, borderColor: putBorder, borderStyle: "solid" };
      case "bad":
        return { bg: badFill, borderColor: badBorder, borderStyle: "solid" };
      default:
        return { bg: "surface.canvas", borderColor: emptyBorder, borderStyle: "solid" };
    }
  };

  const cellAt = (e: { clientX: number; clientY: number }): Cell | undefined => {
    const el = innerRef.current;
    if (!el) return undefined;
    const box = el.getBoundingClientRect();
    return cellFromPoint(e.clientX, e.clientY, box, metrics, size, clamp);
  };

  const sparseAxis = metrics.cell < 14;
  const rows = Array.from({ length: size.rows }, (_, r) => r);
  const cols = Array.from({ length: size.cols }, (_, c) => c);
  const axisProps = {
    fontSize: "11px",
    color: mutedText,
    textAlign: "center" as const,
    lineHeight: `${metrics.headerY}px`,
    "aria-hidden": true,
  };

  return (
    <Box overflowX="auto" maxW="100%">
      <Box
        ref={innerRef}
        role="group"
        aria-label={label}
        aria-describedby={describedBy}
        display="grid"
        gridTemplateColumns={`${metrics.gutterX}px repeat(${size.cols}, ${metrics.cell}px)`}
        gridTemplateRows={`${metrics.headerY}px repeat(${size.rows}, ${metrics.cell}px)`}
        gap="3px"
        w="max-content"
        userSelect="none"
        style={{ touchAction: "none" }}
        onPointerDown={
          onPointerDown
            ? (e: ReactPointerEvent<HTMLDivElement>) => {
                if (e.button !== 0) return;
                onPointerDown(e, cellAt(e));
              }
            : undefined
        }
        onPointerMove={onPointerMove ? (e) => onPointerMove(e, cellAt(e)) : undefined}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onPointerLeave={onPointerLeave}
        onClick={onClick ? (e) => onClick(cellAt(e)) : undefined}>
        <Box aria-hidden />
        {cols.map((c) => (
          <Text as="span" key={`h${c}`} {...axisProps}>
            {sparseAxis && c % 2 === 1 ? "" : c + 1}
          </Text>
        ))}
        {rows.map((r) => [
          <Text as="span" key={`l${r}`} {...axisProps} lineHeight={`${metrics.cell}px`}>
            {rowLabel(r)}
          </Text>,
          ...cols.map((c) => (
            <Box
              key={`w${r}-${c}`}
              aria-hidden
              w={`${metrics.cell}px`}
              h={`${metrics.cell}px`}
              borderRadius="full"
              borderWidth="0.5px"
              boxSizing="border-box"
              cursor={notAllowed ? "not-allowed" : "crosshair"}
              {...styleFor(stateAt(r, c))}
            />
          )),
        ])}
      </Box>
    </Box>
  );
}

function PlaceholderBox({ text }: { text: string }) {
  const muted = useColorModeValue("gray.600", "whiteAlpha.700");
  return (
    <Box
      borderWidth="1px"
      borderStyle="dashed"
      borderRadius="md"
      p={4}
      minW="240px"
      fontSize="sm"
      color={muted}
      textAlign="center">
      {text}
    </Box>
  );
}

export function WellPicker({
  plates,
  values,
  allowVariables,
  fieldsLayout,
  renderField,
  onPatch,
}: WellPickerProps) {
  const [hover, setHover] = useState<Cell | undefined>(undefined);
  const [open, setOpen] = useState(false);
  // The drag anchor and the last rectangle emitted live in refs: neither is
  // form state and neither may trigger a render on its own.
  const anchor = useRef<Cell | undefined>(undefined);
  const lastRect = useRef<Rect | undefined>(undefined);

  const statusId = useId();
  const collapseId = useId();
  const flagIdBase = useId();

  const panelBg = useColorModeValue("gray.50", "surface.section");
  const muted = useColorModeValue("gray.600", "whiteAlpha.700");
  const warning = useColorModeValue("orange.600", "orange.300");
  const danger = useColorModeValue("red.700", "red.300");

  const view = buildWellPickerView({ plates, values, allowVariables, hover });
  const expanded = open || view.forced;

  const endDrag = () => {
    anchor.current = undefined;
    lastRect.current = undefined;
  };

  const sourceStateAt = (r: number, c: number): WellState => {
    const s = view.sourceRect;
    if (s && inRect(r, c, s.rect)) return s.bad ? "bad" : "sel";
    return "empty";
  };
  const destStateAt = (r: number, c: number): WellState => {
    const f = view.footprint;
    if (f && inRect(r, c, f.rect)) return f.state;
    return "empty";
  };

  const renderColumn = (
    title: string,
    side: GridSide,
    caption: string | undefined,
    grid: ReactNode,
    extra?: ReactNode,
  ) => (
    <Box minW={0} maxW="100%">
      <Text fontSize="sm" fontWeight="bold">
        {title}
      </Text>
      {side.kind === "grid" ? (
        <>
          <Text fontSize="xs" color={muted} mb={1}>
            {caption}
          </Text>
          {grid}
        </>
      ) : (
        <Box mt={2}>
          <PlaceholderBox text={side.text} />
        </Box>
      )}
      {extra}
    </Box>
  );

  const sourceGrid =
    view.source.kind === "grid" && view.sourceMetrics ? (
      <WellGrid
        label="Source plate grid"
        describedBy={statusId}
        size={view.source.size}
        metrics={view.sourceMetrics}
        stateAt={sourceStateAt}
        notAllowed={false}
        clamp
        onPointerDown={(e, cell) => {
          if (!cell) return;
          const rect = dragRect(cell, cell);
          anchor.current = cell;
          lastRect.current = rect;
          onPatch(sourcePatch(rect));
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Capture can be refused (synthetic or already-ended pointer); the drag still works.
          }
        }}
        onPointerMove={(_e, cell) => {
          const a = anchor.current;
          if (!a || !cell) return;
          const rect = dragRect(a, cell);
          if (sameRect(lastRect.current, rect)) return;
          lastRect.current = rect;
          onPatch(sourcePatch(rect));
        }}
        onPointerUp={(e) => {
          endDrag();
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // Already released.
          }
        }}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      />
    ) : null;

  const destGrid =
    view.dest.kind === "grid" && view.destMetrics ? (
      <WellGrid
        label="Destination plate grid"
        describedBy={statusId}
        size={view.dest.size}
        metrics={view.destMetrics}
        stateAt={destStateAt}
        notAllowed={view.mismatch !== undefined}
        clamp={false}
        onPointerMove={(_e, cell) => {
          const next = view.destClickable ? cell : undefined;
          setHover((prev) => (prev?.r === next?.r && prev?.c === next?.c ? prev : next));
        }}
        onPointerLeave={() => setHover(undefined)}
        onClick={(cell) => {
          if (!cell) return;
          const patch = destClickPatch(view, values, allowVariables, cell);
          if (patch) onPatch(patch);
        }}
      />
    ) : null;

  const mismatchRow = view.mismatch ? (
    <HStack mt={2} spacing={2} align="start" color={warning}>
      <WarningTwoIcon aria-hidden mt={1} />
      <Text fontSize="sm">{view.mismatch}</Text>
    </HStack>
  ) : null;

  const fieldBlocks = WELL_FIELDS.map((name) => {
    const flag = view.flags[name];
    const flagId = `${flagIdBase}-${name}`;
    return (
      <Box key={name} role="group" aria-describedby={flag ? flagId : undefined}>
        <Text fontSize="sm" mb={1}>
          {name}
        </Text>
        {renderField(name)}
        {flag ? (
          <Text id={flagId} fontSize="sm" color={warning} mt={1}>
            {flag}
          </Text>
        ) : null}
      </Box>
    );
  });

  return (
    <Box bg={panelBg} borderRadius="xl" p={4} w="100%">
      <Flex wrap="wrap" gap={6}>
        {renderColumn(SOURCE_PLATE_TITLE, view.source, view.sourceCaption, sourceGrid)}
        {renderColumn(DEST_PLATE_TITLE, view.dest, view.destCaption, destGrid, mismatchRow)}
      </Flex>
      <Text
        id={statusId}
        mt={4}
        fontSize="xs"
        minH="16px"
        aria-live="polite"
        color={view.status.tone === "danger" ? danger : muted}>
        {view.status.text}
      </Text>
      <HStack mt={2} spacing={2} wrap="wrap">
        <Button
          variant="link"
          size="sm"
          colorScheme="teal"
          aria-expanded={expanded}
          aria-controls={collapseId}
          aria-disabled={view.forced ? true : undefined}
          rightIcon={expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          onClick={() => {
            if (!view.forced) setOpen((o) => !o);
          }}>
          {EDIT_AS_FIELDS_LABEL}
        </Button>
        {view.forced && view.note ? (
          <Text fontSize="xs" color={muted}>
            {view.note}
          </Text>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          isDisabled={view.clearDisabled}
          onClick={() => onPatch(CLEAR_PATCH)}>
          {CLEAR_SELECTION_LABEL}
        </Button>
      </HStack>
      <Collapse id={collapseId} in={expanded} animateOpacity>
        <Box pt={4}>
          {fieldsLayout === "grid" ? (
            <SimpleGrid minChildWidth="120px" spacing={2}>
              {fieldBlocks}
            </SimpleGrid>
          ) : (
            <VStack align="stretch" spacing={4}>
              {fieldBlocks}
            </VStack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// The wrapper every host renders. It reads the plate list through the same
// (toolId, fast.plates) react-query entry the plate dropdowns use, so there is
// no extra read, poll or retry (D-16). WellPicker itself stays read-free.
export function FastTransferWellPicker({
  toolId,
  enabled,
  ...rest
}: { toolId: string | undefined; enabled: boolean } & Omit<WellPickerProps, "plates">) {
  const { mode, data } = useToolOptions(toolId, "fast.plates", enabled);
  return <WellPicker plates={plateListInput(mode, data)} {...rest} />;
}
