requirejs
(
    ["es6-promise"],
    /**
     * @summary Main entry point for the application.
     * @description Performs application initialization as the first step in the RequireJS load sequence.
     * @see http://requirejs.org/docs/api.html#data-main
     * @name openjscad
     * @exports openjscad
     * @version 1.0
     */
    function (es6_promise)
    {
        var CANVAS = "canvas"; // the element id of the canvas
        var EDITOR = "editor"; // the element id of the editor
        var gl = null;

        // using Promise: backwards compatibility for older browsers
        es6_promise.polyfill ();

        function initGL ()
        {
            var canvas;

            if (!(canvas = document.getElementById (CANVAS)))
                alert ("Element '" + CANVAS + "' not found");
            else
                try
                {
                    // on mobile platforms you must ask for experimental-webgl first
                    gl = canvas.getContext ("experimental-webgl");
                }
                catch (e)
                {
                    try
                    {
                        gl = canvas.getContext ("webgl");
                        gl.viewport (0, 0, canvas.width, canvas.height);
                    }
                    catch (e)
                    {
                        alert ("Failed to initialise WebGL: " + JSON.stringify (e));
                    }
                }
        }

        function isOK (xhr)
        {
            var file;
            var ret;

            file = 0 == xhr.responseURL.indexOf ("file:");
            ret = !!xhr.response;
            if (!file)
                ret = ret && ((xhr.status >= 200) && (xhr.status < 300));

            return (ret);
        };
        function get (url)
        {
            function promise (resolve, reject)
            {
                var req = new XMLHttpRequest ();
                req.open ("GET", url);

                req.onload = function ()
                {
                    if (isOK (req))
                       resolve (req.response);
                    else
                      reject (Error (req.statusText));
                };

                req.onerror = function ()
                {
                    reject (Error ("network error"));
                };

                req.send();
            }

            return (new Promise (promise));
        }

        function compileShader (gl, type, text)
        {
            var ret;

            ret = gl.createShader (type);
            if (ret)
            {
                gl.shaderSource (ret, text);
                gl.compileShader (ret);

                if (!gl.getShaderParameter (ret, gl.COMPILE_STATUS))
                {
                    alert (gl.getShaderInfoLog (ret));
                    ret = null;
                }
            }

            return (ret);
        }

        function getShaders (gl, files)
        {
            var ret;

            function fetcher (url)
            {
                var type;
                var ret;

                if (-1 != url.indexOf ("fragment.glsl"))
                    type = gl.FRAGMENT_SHADER;
                else if (-1 != url.indexOf ("vertex.glsl"))
                    type = gl.VERTEX_SHADER;
                else
                    throw ("unknown shader type: " + url);

                ret = get (url).then
                (
                    function (text)
                    {
                        return (compileShader (gl, type, text));
                    }
                );

                return (ret);
            }

            ret = files.map (fetcher);

            return (ret);
        }

        var aVertexPosition;
        var aPlotPosition;
        var cameraPos;
        var sphere1Center;
        var sphere2Center;
        var sphere3Center;

        function initProgram ()
        {
            var code = ["shaders/default.fragment.glsl", "shaders/default.vertex.glsl"];
            var all;
            var ret;

            all = Promise.all (getShaders (gl, code));
            ret = all.then
            (
                function (shaders)
                {
                    var shaderProgram;

                    shaderProgram = gl.createProgram ();
                    shaders.map
                    (
                        function (shader)
                        {
                            gl.attachShader (shaderProgram, shader);
                        }
                    );

                    gl.linkProgram (shaderProgram);

                    if (!gl.getProgramParameter (shaderProgram, gl.LINK_STATUS))
                        alert ("Could not link shader program");

                    gl.useProgram (shaderProgram);

                    aVertexPosition = gl.getAttribLocation (shaderProgram, "aVertexPosition");
                    gl.enableVertexAttribArray (aVertexPosition);

                    aPlotPosition = gl.getAttribLocation (shaderProgram, "aPlotPosition");
                    gl.enableVertexAttribArray (aPlotPosition);

                    cameraPos = gl.getUniformLocation (shaderProgram, "cameraPos");
                    sphere1Center = gl.getUniformLocation (shaderProgram, "sphere1Center");
                    sphere2Center = gl.getUniformLocation (shaderProgram, "sphere2Center");
                    sphere3Center = gl.getUniformLocation (shaderProgram, "sphere3Center");
                }
            );

            return (ret);
        }

        function initBuffers ()
        {
            var vertices;
            var vertexPositionBuffer;
            var plotPositionBuffer;

            vertices = [ 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0, ];
            vertexPositionBuffer = gl.createBuffer ();
            gl.bindBuffer (gl.ARRAY_BUFFER, vertexPositionBuffer);
            gl.bufferData (gl.ARRAY_BUFFER, new Float32Array (vertices), gl.STATIC_DRAW);
            gl.bindBuffer (gl.ARRAY_BUFFER, vertexPositionBuffer);
            gl.vertexAttribPointer (aVertexPosition, 2, gl.FLOAT, false, 0, 0);
            plotPositionBuffer = gl.createBuffer ();
            gl.bindBuffer (gl.ARRAY_BUFFER, plotPositionBuffer);
            gl.vertexAttribPointer (aPlotPosition, 3, gl.FLOAT, false, 0, 0);
        }

        function crossProd (v1, v2)
        {
            return (
            {
                x : v1.y * v2.z - v2.y * v1.z,
                y : v1.z * v2.x - v2.z * v1.x,
                z : v1.x * v2.y - v2.x * v1.y
            });
        }

        function normalize (v)
        {
            var l = Math.sqrt (v.x * v.x + v.y * v.y + v.z * v.z);
            return (
            {
                x : v.x / l,
                y : v.y / l,
                z : v.z / l
            });
        }

        function vectAdd (v1, v2)
        {
            return (
            {
                x : v1.x + v2.x,
                y : v1.y + v2.y,
                z : v1.z + v2.z
            });
        }

        function vectSub (v1, v2)
        {
            return (
            {
                x : v1.x - v2.x,
                y : v1.y - v2.y,
                z : v1.z - v2.z
            });
        }

        function vectMul (v, l)
        {
            return (
            {
                x : v.x * l,
                y : v.y * l,
                z : v.z * l
            });
        }

        function pushVec (v, arr)
        {
            arr.push (v.x, v.y, v.z);
        }

        var t = 0;
        function drawScene ()
        {
            var canvas;
            var ratio;
            var x1;
            var y1;
            var z1;
            var x2;
            var y2;
            var z2;
            var x3;
            var y3;
            var z3;
            var up;
            var cameraFrom;
            var cameraTo;
            var cameraPersp;
            var cameraDir;
            var cameraLeft;
            var cameraCenter;
            var cameraUp;
            var cameraTopLeft;
            var cameraBotLeft;
            var cameraTopRight;
            var cameraBotRight;

            canvas = document.getElementById (CANVAS);
            if (canvas)
                ratio = canvas.offsetWidth / canvas.offsetHeight;
            else
                ratio = 1.0;

            x1 = Math.sin (t * 1.1) * 1.5;
            y1 = Math.cos (t * 1.3) * 1.5;
            z1 = Math.sin (t + Math.PI / 3) * 1.5;
            x2 = Math.cos (t * 1.2) * 1.5;
            y2 = Math.sin (t * 1.4) * 1.5;
            z2 = Math.sin (t * 1.25 - Math.PI / 3) * 1.5;
            x3 = Math.cos (t * 1.15) * 1.5;
            y3 = Math.sin (t * 1.37) * 1.5;
            z3 = Math.sin (t * 1.27) * 1.5;

            cameraFrom =
            {
                x : Math.sin (t * 0.4) * 18,
                y : Math.sin (t * 0.13) * 5 + 5,
                z : Math.cos (t * 0.4) * 18
            };
            cameraTo =
            {
                x : 0,
                y : 0,
                z : 0
            };
            cameraPersp = 6;
            up =
            {
                x : 0,
                y : 1,
                z : 0
            };
            cameraDir = normalize (vectSub (cameraTo, cameraFrom));

            cameraLeft = normalize (crossProd (cameraDir, up));
            cameraUp = normalize (crossProd (cameraLeft, cameraDir));
            // cameraFrom + cameraDir * cameraPersp
            cameraCenter = vectAdd (cameraFrom, vectMul (cameraDir, cameraPersp));
            // cameraCenter + cameraUp + cameraLeft * ratio
            cameraTopLeft = vectAdd (vectAdd (cameraCenter, cameraUp), vectMul (cameraLeft, ratio));
            cameraBotLeft = vectAdd (vectSub (cameraCenter, cameraUp), vectMul (cameraLeft, ratio));
            cameraTopRight = vectSub (vectAdd (cameraCenter, cameraUp), vectMul (cameraLeft, ratio));
            cameraBotRight = vectSub (vectSub (cameraCenter, cameraUp), vectMul (cameraLeft, ratio));

            //corners = [1.2, 1, -12, -1.2, 1, -12, 1.2, -1, -12, -1.2, -1, -12];
            var corners = [];
            pushVec (cameraTopRight, corners);
            pushVec (cameraTopLeft, corners);
            pushVec (cameraBotRight, corners);
            pushVec (cameraBotLeft, corners);

            gl.bufferData (gl.ARRAY_BUFFER, new Float32Array (corners), gl.STATIC_DRAW);

            gl.uniform3f (cameraPos, cameraFrom.x, cameraFrom.y, cameraFrom.z);
            gl.uniform3f (sphere1Center, x1, y1, z1);
            gl.uniform3f (sphere2Center, x2, y2, z2);
            gl.uniform3f (sphere3Center, x3, y3, z3);

            gl.drawArrays (gl.TRIANGLE_STRIP, 0, 4);

            t += 0.03;
            if (t > Math.PI * 200)
                t -= Math.PI * 200;
        }

        function webGLStart ()
        {
            initGL ();
            if (null != gl)
                initProgram ().then
                (
                    function ()
                    {
                        gl.clearColor (0.0, 0.0, 0.0, 1.0);
                        gl.clearDepth (1.0);
                        initBuffers ();
                        fillScreen ();
                    }
                );
        }

        function initialize_editor ()
        {
            var editor;

            if (!document.getElementById (EDITOR))
                alert ("Element '" + EDITOR + "' not found");
            else
            {
                editor = ace.edit (EDITOR);
                editor.setTheme ("ace/theme/chrome");
                editor.getSession ().setMode ("ace/mode/javascript");
                editor.setBehavioursEnabled (false);
                editor.getSession ().setUseSoftTabs (true);
                editor.getSession ().setTabSize (4);
                editor.setShowInvisibles (true);
            }
        }

        var resizeTimer = null; // the JavaScript timer object
        var downCount = [0]; // number of milliseconds to wait before adjusting

        function fillScreen ()
        {
            var canvas;
            var parent;
            var height;
            var width;
            var editor;

            canvas = document.getElementById (CANVAS);
            if (canvas)
            {
                parent = canvas.parentNode;
                width = parent.offsetWidth;
                height = parent.offsetHeight;
                canvas.width = width;
                canvas.height = height;
                gl.viewport (0, 0, canvas.width, canvas.height);
                drawScene ();

                editor = document.getElementById (EDITOR);
                if (editor)
                    editor.height = height;
            }
        }

        function countDown (me, count)
        {
            var tbd;

            tbd = count[0] != 0;
            if (tbd)
                count[0]--;
            tbd &= count[0] <= 0;
            if (tbd)
            {
                count[0] = 0;
                fillScreen (); // resizeScreen.call (me);
            }
        }

        function initialize ()
        {
            window.onresize = function ()
            {
                downCount[0] = 100;
            };
            resizeTimer = setInterval (countDown, 1, this, downCount);
            webGLStart ();
            initialize_editor ();
        }

        initialize (); //  onload="initialize()"
    }
);
