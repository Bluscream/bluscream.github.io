i want you to look through make a plain html+css+js website at @index.html which has a global options group ontop with a "Scale" slider from 1-200%, two full-width mulitline textboxes side-by-side below that (one for yaml input and one for yaml output) and a third "Overrides" textbox below them with the loaded contents from @defaults.jsonc

use syntax highlighting where possible. you can use third party libs like jquery but use their most up-to date versions and dont directly embed them if you do.

the user should be able to paste yaml content like @example_input.yml or any part within it into the input textbox, the site will then try to find the "elements" array in it, apply the overrides specified by the overrides textbox json content and spit the result into the output field keeping the structure of the input intact

you should outsource css and js where possible

the scale slider should be used to scale the items that were not matched by any override