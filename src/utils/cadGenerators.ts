import { FurnaceInputs, CalculationResults, DxfModSchema } from '../types/furnace';

export function generateAutoLispScript(inputs: FurnaceInputs, results: CalculationResults): string {
  return `;====================================================================
; VULCAN PARAMETRIC FURNACE DRAWING AUTOMATION SCRIPT (.LSP)
; Target Capacity: ${inputs.targetCapacity} Tons | Target Power: ${inputs.targetPower} MW
; Generated on: ${new Date().toLocaleString()}
;====================================================================

(defun c:UPDATE_FURNACE_2D ()
  (setq old_cmdecho (getvar "CMDECHO"))
  (setvar "CMDECHO" 0)
  
  (princ "\\n--> Updating Induction Furnace Drawing Geometry...")

  ; --- CAD MODIFICATION PARAMETERS ---
  (setq target_id ${results.targetInnerDiameterMm})        ; Crucible Inner Diameter (mm)
  (setq target_height ${results.targetCrucibleHeightMm})    ; Crucible Chamber Height (mm)
  (setq target_thk ${results.targetRefractoryThicknessMm})   ; Refractory Lining Thickness (mm)
  (setq target_turns ${results.targetCoilTurns})          ; Coil Turn Count
  (setq target_shell ${results.outerShellDiameterMm})      ; Shell Outer Diameter (mm)
  (setq coil_pitch ${results.calculatedCoilPitchMm})      ; Coil Pitch (mm)

  ; --- LAYER CREATION & ENFORCEMENT ---
  (command "-LAYER" "M" "FURNACE_CRUCIBLE" "C" "3" "" "L" "CONTINUOUS" "" "")
  (command "-LAYER" "M" "FURNACE_REFRACTORY" "C" "1" "" "L" "CONTINUOUS" "" "")
  (command "-LAYER" "M" "FURNACE_COIL" "C" "2" "" "L" "CONTINUOUS" "" "")
  (command "-LAYER" "M" "FURNACE_SHELL" "C" "7" "" "L" "CONTINUOUS" "" "")
  (command "-LAYER" "M" "FURNACE_DIMENSIONS" "C" "4" "" "L" "CONTINUOUS" "" "")

  ; --- UPDATE DYNAMIC BLOCK ATTRIBUTES IF PRESENT ---
  (setq ss (ssget "X" '((0 . "INSERT") (2 . "INDUCTION_FURNACE_BLOCK"))))
  (if ss
    (progn
      (setq ent (ssname ss 0))
      (setq att (entnext ent))
      (while (and att (/= (cdr (assoc 0 (entget att))) "SEQEND"))
        (setq tag (cdr (assoc 2 (entget att))))
        (cond
          ((= tag "INNER_DIAMETER") (entmod (subst (cons 1 (rtos target_id 2 1)) (assoc 1 (entget att)) (entget att))))
          ((= tag "CRUCIBLE_HEIGHT") (entmod (subst (cons 1 (rtos target_height 2 1)) (assoc 1 (entget att)) (entget att))))
          ((= tag "REFRACTORY_THICKNESS") (entmod (subst (cons 1 (rtos target_thk 2 1)) (assoc 1 (entget att)) (entget att))))
          ((= tag "COIL_TURNS") (entmod (subst (cons 1 (itoa target_turns)) (assoc 1 (entget att)) (entget att))))
        )
        (setq att (entnext att))
      )
      (princ "\\n--> Successfully updated Dynamic Block Attributes.")
    )
    (princ "\\n--> Note: Block 'INDUCTION_FURNACE_BLOCK' not found. Executing parametric draw.")
  )

  (setvar "CMDECHO" old_cmdecho)
  (princ "\\n--> Furnace Drawing Update Complete!")
  (princ)
)

(princ "\\n--> Type UPDATE_FURNACE_2D to execute parametric drawing modifications.")
(princ)
`;
}

export function generateAutoCadCommandScript(inputs: FurnaceInputs, results: CalculationResults): string {
  const halfID = results.targetInnerDiameterMm / 2;
  const outerRadius = halfID + results.targetRefractoryThicknessMm;
  const shellRadius = results.outerShellDiameterMm / 2;

  return `; AutoCAD Batch Command Script (.SCR) for Induction Furnace 2D
; Run command: SCRIPT furnace_draw.scr
;
-LAYER M FURNACE_CRUCIBLE C 3  
RECTANG -${halfID},0 ${halfID},${results.targetCrucibleHeightMm}
;
-LAYER M FURNACE_REFRACTORY C 1  
RECTANG -${outerRadius},-${results.targetRefractoryThicknessMm} ${outerRadius},${results.targetCrucibleHeightMm + 50}
;
-LAYER M FURNACE_SHELL C 7  
RECTANG -${shellRadius},-${results.targetRefractoryThicknessMm + 20} ${shellRadius},${results.targetCrucibleHeightMm + 80}
;
-LAYER M FURNACE_DIMENSIONS C 4  
DIMLINEAR -${halfID},0 ${halfID},0 -${halfID},-${results.targetRefractoryThicknessMm / 2}
DIMLINEAR -${halfID},0 -${halfID},${results.targetCrucibleHeightMm} -${halfID + 80},0
;
ZOOM E
`;
}

export function generateDxfTextSnippet(inputs: FurnaceInputs, results: CalculationResults): string {
  const halfID = results.targetInnerDiameterMm / 2;
  const thk = results.targetRefractoryThicknessMm;
  const height = results.targetCrucibleHeightMm;

  return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
FURNACE_CRUCIBLE
10
-${halfID}
20
0.0
30
0.0
11
${halfID}
21
0.0
31
0.0
0
LINE
8
FURNACE_CRUCIBLE
10
-${halfID}
20
${height}
30
0.0
11
${halfID}
21
${height}
31
0.0
0
CIRCLE
8
FURNACE_TOP_VIEW
10
0.0
20
0.0
30
0.0
40
${halfID}
0
CIRCLE
8
FURNACE_REFRACTORY
10
0.0
20
0.0
30
0.0
40
${halfID + thk}
0
ENDSEC
0
EOF
`;
}

export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
