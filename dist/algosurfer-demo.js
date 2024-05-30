
///////////////////////////////////////////////////////////////////////////////
// Imported modules
import * as THREE from './three.module.js';
//import { GUI } from 'three/addons/lil-gui.module.min.js';
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// Identify media
let nbcanvas = 12;
if (window.matchMedia("(max-width: 767px)").matches)
    nbcanvas = 6; // cannot support probably more than 6 webgl canvas
if (window.matchMedia("(max-width: 1024px)").matches)
    nbcanvas = 9; // cannot support probably more than 9 webgl canvas
///////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////
// Build predefined shapes
var shapeRE       = /^shape/;
var shape_models  = [];
var functions     = document.querySelector( '#imported-functions'); // in <object> tag
var doc_functions = functions.contentDocument;
var shaders       = document.querySelector( '#imported-shaders'); // in <object> tag
var doc_shaders   = shaders.contentDocument;
console.log( doc_shaders );
var els           = doc_functions.getElementsByTagName('*');
//document.getElementsByTagName('*');
let idx           = 0;
for (var e in els) {
    if ( shapeRE.test( els[ e ].id ) ) {
	let shape = JSON.parse( doc_functions.getElementById( els[ e ].id ).value );
	shape.id  = idx;
	idx      += 1;
	shape_models.push( shape );
	console.log( shape );
    }
}
console.log( "Read " + shape_models.length + " shape models" );
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
let   textureCube = null;
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// create several rendering canvases
const distance     = 200.0; //< distance of camera to shape center
let next_canvas_id = 0;
var   CanvasInfo   = makeStruct("id renderer camera scene settings uniforms");
var   canvas_infos = [];
const canvas_base  = "webglcanvas";
for ( let i = 0; i < nbcanvas; i++ )
{
    let shape_id, already_present;
    do {
	shape_id = randomInt(0, shape_models.length);
	already_present = false;
	for ( let j = 0; j < canvas_infos.length; j++ ) {
	    if ( canvas_infos[ j ].settings.shape == shape_id ) {
		already_present = true;
		break;
	    }
	}
    } while ( already_present );
    let cinfos = init( i, shape_id, shape_models );
    canvas_infos.push( cinfos );
    let canvas_name = canvas_base + i;
    var canvas = document.getElementById( canvas_name );
    canvas.addEventListener('click', function( event ) {
	let index    = parseInt( event.currentTarget.id.substring( canvas_base.length ) );
	let shape_id = canvas_infos[ index ].settings.shape; 
	let dmode_id = canvas_infos[ index ].settings.display_mode;
	let cmodel_id= canvas_infos[ index ].settings.color_model;
	let a        = canvas_infos[ index ].settings.a;
	let b        = canvas_infos[ index ].settings.b;
	let c        = canvas_infos[ index ].settings.c;
	let scale    = canvas_infos[ index ].settings.scale;
	let bg_mode  = canvas_infos[ index ].settings.bg_mode;
	let transparency = canvas_infos[ index ].settings.transparency;
	let reflection = canvas_infos[ index ].settings.reflection;
	window.location.href = 'algosurfer-implicit-surface-viewer.html?'
	    + 'shape=' + shape_id
	    + '&dmode=' + dmode_id
	    + '&cmodel=' + cmodel_id
	    + '&a=' + a.toFixed(3) + '&b=' + b.toFixed(3) + '&c=' + c.toFixed(3)
	    + '&scale=' + scale.toFixed(3)
	    + '&bg_mode=' + bg_mode
	    + '&tra=' + transparency.toFixed(2)
	    + '&ref=' + reflection.toFixed(2);
    }, false);
}

// Force resize of windows for responsiveness
onWindowResize();
window.addEventListener( 'resize', onWindowResize );
animate();
///////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////
// Initialize the given canvas `canvas_id`, and add an element to `canvas_info`.
function init( canvas_id, shape_id, shape_models ) {
    var scene, object;
    // (1) renderer in canvas
    let canvas_name = "webglcanvas" + canvas_id;
    var canvas = document.getElementById( canvas_name );
    var renderer = new THREE.WebGLRenderer( { canvas : canvas,
					      antialias: false } );
    renderer.setSize( canvas.width, canvas.height ); // Set viewport size
    var camera = new THREE.PerspectiveCamera( 45, canvas.width/canvas.height, 1, 2000 );
    camera.position.x = distance; // Math.cos( timer ) * distance;
    camera.position.z = 0.0; // Math.sin( timer ) * distance;
    camera.position.y = 0;
    var settings = randomizeSettings( makeSettings( canvas_id ), shape_id, shape_models );
    var uniforms = makeUniforms( settings ); 
    //
    scene = new THREE.Scene();
    var shader   = makeFragmentShader( settings, uniforms );    
    var geometry = makeViewShape( settings.view_shape, settings.view_radius );
    object = new THREE.Mesh( geometry, shader );
    object.position.set( 0, 0, 0 );
    scene.add( object );
    // camera.lookAt( object.position );
    let subtitle = shape_models[ settings.shape ].name
	+ " (" + stringFromDisplayMode( settings.display_mode )
	+ " / " + stringFromColorModel( settings.color_model ) + ")";
    updateCanvasSubtitle( canvas_id, subtitle );
    
    //var CanvasInfo = makeStruct("id renderer camera scene settings uniforms");
    var cinfos = new CanvasInfo( canvas_id, renderer, camera, scene, settings, uniforms );
    return cinfos;
}

function trimString(str, minLength, maxLength) { 
    if (str.length > maxLength) { 
        return str.slice(0, maxLength - 3) + '...'; 
    }
    while ( str.length < minLength ) str += '\xa0';
    return str; 
} 

function updateCanvasSubtitle( canvas_id, str ) {
    let subtitle_name = "subtitle" + canvas_id;
    document.getElementById( subtitle_name ).innerHTML = trimString(str, 25, 35);
}

function stringFromColorModel( color_model ) {
    const name = [ "Basic", "Phong", "Phong+lights" ];
    return name[ color_model ];
}
function stringFromDisplayMode( display_mode ) {
    const name = [ "Surface", "Normals", "Mean curvatures", "Gaussian curvatures",
		   "Convex/Concave", "Principal dirs" ];
    if ( display_mode >= name.length )
	console.log( "Error: display_mode = " + display_mode );
    return name[ display_mode ];
}

function makeUniformColor( color ) {
    return new THREE.Vector3( color[ 0 ], color[ 1 ], color[ 2 ] );
}

function makeUniforms( settings ) {
    let uniforms = {
	width           : { value : settings.width },
	height          : { value : settings.height },	
	bg_mode         : { value : settings.bg_mode },
	bg_color        : { value : makeUniformColor( settings.bg_color ) },
	ambient_color   : { value : new THREE.Vector3( 0.01, 0.0, 0.0 ) },
	ext_diff_color  : { value : makeUniformColor( settings.ext_diff_color ) },
	int_diff_color  : { value : makeUniformColor( settings.int_diff_color ) },
	specular_color  : { value : new THREE.Vector3( 1.0, 1.0, 1.0 ) },
	sing_color      : { value : new THREE.Vector3( 1.0, 1.0, 1.0 ) },	      
	shininess       : { value: settings.shininess },
	opacity         : { value: settings.opacity },
	transparency    : { value: settings.transparency },
	reflection      : { value: settings.reflection },
	curv_scale      : { value: settings.curv_scale },
	princ_curv      : { value: settings.princ_curv },
	light1_color    : { value : new THREE.Vector3( 0.95, 0.8, 0.0 ) },
	light1_direction: { value : new THREE.Vector3( 0.0, 1.0, 0.0 ) },
	light2_color    : { value : new THREE.Vector3( 0.1, 0.1, 1.0 ) },
	light2_direction: { value : new THREE.Vector3( 1.0, 0.0, 0.0 ) },
	singularity     : { value: settings.singularity },
	accuracy        : { value: settings.accuracy },	      
	scale           : { value: settings.scale },
	shape           : { value: settings.shape },
	iso             : { value: settings.iso },
	a               : { value: settings.a },
	b               : { value: settings.b },
	c               : { value: settings.c },
	center_x        : { value: settings.center_x },
	center_y        : { value: settings.center_y },
	center_z        : { value: settings.center_z },	      	      
	grid_size       : { value: settings.grid_size },
	grid_thickness  : { value: settings.grid_thickness },
	grid_attenuation: { value: settings.grid_attenuation },	      	      
	display_mode    : { value: settings.display_mode },
	color_model     : { value: settings.color_model },
	grid_mode       : { value: settings.grid_mode },
	time            : { value: settings.time },
	camera_distance : { value: settings.camera_distance },
	view_radius     : { value: settings.view_radius },
	cubeMap         : { value: textureCube },
	nb_bissections  : { value: settings.nb_bissections },
	nb_reflections  : { value: settings.nb_reflections },
	nb_refractions  : { value: settings.nb_refractions },
	interior_index  : { value: settings.interior_index },
	dir_color_on    : { value: makeUniformColor( settings.dir_color_on ) },
	dir_color_off   : { value: makeUniformColor( settings.dir_color_off ) },
	dir_on_opacity  : { value: settings.dir_on_opacity },
	dir_off_opacity : { value: settings.dir_off_opacity }
    };
    return uniforms;
}

// integer in [min,max[
function randomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}
// float in [min,max[
function randomFloat(min, max) {
  return (Math.random() * (max - min)) + min;
}
//
function randomizeSettings( settings, shape_id, shape_models ) {
    settings.shape = shape_id;
    // settings.shape = randomInt(0, shape_models.length);
    settings.bg_mode = 0;
    let model      = shape_models[ settings.shape ];
    if ( "color_model" in model )
	settings.color_model = model.color_model[ randomInt( 0, model.color_model.length ) ];
    else
	settings.color_model = randomInt(0, 3);
    settings.display_mode = randomInt(0, 6);
    if ( "display_mode" in model )
	settings.display_mode = model.display_mode[ randomInt( 0, model.display_mode.length ) ];
    if ( settings.display_mode == 5 )
    {
	settings.bg_color = [0.95,0.95,0.95];
	settings.bg_mode = randomInt(0,3);
    }	
    else if ( settings.display_mode == 6 )
    { // reflection
	settings.display_mode = 0;
	settings.reflection = 0.7;
	settings.bg_mode = randomInt(1,3);
    }
    else if ( settings.display_mode >= 7 )
    { // transparency
	settings.display_mode = 0;
	settings.transparency = 0.6;
	settings.bg_mode = randomInt(1,3);
    }
    if ( "scale" in model )
	settings.scale = randomFloat( model.scale[ 0 ], model.scale[ 1 ] );
    else
	settings.scale       = 10.0*(1.0+Math.random());
    if ( "accuracy" in model )    settings.accuracy    = model.accuracy;
    if ( "singularity" in model ) settings.singularity = model.singularity;
    if ( "view_shape" in model )
	settings.view_shape = model.view_shape[ randomInt( 0, model.view_shape.length ) ]; 
    else
	settings.view_shape  = randomInt(0, 2)*4;
    if ( "a" in model ) settings.a = randomFloat( model.a[ 0 ], model.a[ 1 ] );
    if ( "b" in model ) settings.b = randomFloat( model.b[ 0 ], model.b[ 1 ] );
    if ( "c" in model ) settings.c = randomFloat( model.c[ 0 ], model.c[ 1 ] );
    if ( "abc" in model ) {
	let i = randomInt( 0, model.abc.length );
	settings.a = model.abc[ i ][ 0 ];
	settings.b = model.abc[ i ][ 1 ];
	settings.c = model.abc[ i ][ 2 ];
    }
    if ( "curv_scale" in model )
	settings.curv_scale = randomFloat( model.curv_scale[ 0 ], model.curv_scale[ 1 ] );
    if ( "princ_curv" in model )
	settings.princ_curv = model.princ_curv[ randomInt( 0, model.princ_curv.length ) ];
    if ( "center_x" in model )
	settings.center_x = randomFloat( model.center_x[ 0 ], model.center_x[ 1 ] );
    if ( "center_y" in model )
	settings.center_y = randomFloat( model.center_y[ 0 ], model.center_y[ 1 ] );
    if ( "center_z" in model )
	settings.center_z = randomFloat( model.center_z[ 0 ], model.center_z[ 1 ] );
    
    settings.ext_diff_color[ 0 ] = 0.5+0.5*Math.random();
    settings.ext_diff_color[ 1 ] = 0.5*Math.random();
    settings.ext_diff_color[ 2 ] = 0.5*Math.random();        
    settings.int_diff_color[ 0 ] = 0.5*Math.random();
    settings.int_diff_color[ 1 ] = 0.5*Math.random();
    settings.int_diff_color[ 2 ] = 0.5+0.5*Math.random();
    if ( settings.display_mode == 2 || settings.display_mode == 3 ) { // curvatures
	settings.ext_diff_color[ 0 ] = 1.0;
	settings.ext_diff_color[ 1 ] = 0.0;
	settings.ext_diff_color[ 2 ] = 0.0;
	settings.int_diff_color[ 0 ] = 0.0;
	settings.int_diff_color[ 1 ] = 0.0;
	settings.int_diff_color[ 2 ] = 1.0;
	settings.color_model = 0;
    }	
    settings.rotation_x  = 0.5*(Math.random()-0.5);
    settings.rotation_y  = 0.275*(Math.random()-0.5);
    settings.rotation_z  = 0.25*(Math.random()-0.5);
    return settings;
}

//
function makeSettings( canvas_id ) {
    var settings = {
	id : canvas_id,
	width         : 300,
	height        : 300,
    bg_mode       : 0,
    bg_color      : [ 0.1, 0.1, 0.1 ],
    ambient_color : [ 0.01, 0.0, 0.0 ],
    ext_diff_color: [ 1.0, 0.25, 0.1 ],
    int_diff_color: [ 0.25, 0.8, 1.0 ],
    specular_color: [ 1.0, 1.0, 1.0 ],
    sing_color    : [ 1.0, 1.0, 1.0 ],	  
    shininess     : 10.0,
    opacity       : 0.6,
    transparency  : 0.0,
    reflection    : 0.0,
    curv_scale    : 1.0,
    princ_curv    : 0,
    light1        : 1,
    light1_color  : [ 0.95, 0.8, 0.0 ],
    light2        : 0,
    light2_color  : [ 0.1, 0.1, 1.0 ],
    singularity   : 0.6,
    accuracy      : 5.0,
    scale         : 10.0,
    shape         : 0,
    iso           : 0.0,
    a             : 1.0,
    b             : 1.0,
    c             : 1.0,
    center_x      : 0.0,
    center_y      : 0.0,
    center_z      : 0.0, 	  	  
    display_mode  : 0,
    color_model   : 1,
    grid_mode     : 0,
    view_shape    : 0,
    view_radius   : 100.0,
    grid_size     : 1.0,
    grid_thickness: 0.1,
    grid_attenuation: 0.5,	  	  
    rotation_x    : 0.0,
    rotation_y    : 0.0,
    rotation_z    : 0.0,
    stop          : function() {
	settings.rotation_x = 0;
	settings.rotation_y = 0;
	settings.rotation_z = 0;
    },
    camera_distance : 200.0,
    anaglyph      : 0,
    eye_sep       : 0.15,
    time          : 0.0,
    nb_bissections: 8,
    nb_reflections: 3,
    nb_refractions: 3,    
    interior_index: 1.1,
    dir_color_on  : [1.0,1.0,1.0],
    dir_on_opacity: 1.0,
    dir_color_off : [0.0,0.0,0.0],
    dir_off_opacity: 1.0
    };
    return settings;
}

// return a structure constructor whose fields are given as words in a
// string separated by a space.
function makeStruct(names) {
    var names = names.split(' ');
    var count = names.length;
    function constructor() {
	for (var i = 0; i < count; i++) {
	    this[names[i]] = arguments[i];
	}
    }
    return constructor;
}


// Resize every canvas/renderer.
function onWindowResize() {
    let width  = 200;
    let ratio  = 1.0;
    if ( window.innerWidth < 600 )
	width = Math.floor( window.innerWidth / 2.0 ) - 30.0;
    else if ( window.innerWidth < 900 )
	width = Math.floor( window.innerWidth / 3.0 ) - 30.0;
    else if ( window.innerWidth < 1200 )
	width = Math.floor( window.innerWidth / 4.0 ) - 30.0;
    else 
	width = Math.floor( window.innerWidth / 6.0 ) - 30.0;
    let height= width * ratio;
    for ( let i = 0; i < canvas_infos.length; i++ )
    {
	let info = canvas_infos[ i ];
	let camera   = info.camera;
	let renderer = info.renderer;
	let settings = info.settings;
	let uniforms = info.uniforms;
	camera.aspect = ratio;
	camera.updateProjectionMatrix();
	renderer.setSize( width, height );
	settings.width        = canvas.width;
	settings.height       = canvas.height;
	uniforms.width.value  = canvas.width;
	uniforms.height.value = canvas.height;    
    }
}

// Animate every canvas
function animate() {
    requestAnimationFrame( animate );
    render();
}

// Update and render every canvas
function render() {
    const timer = Date.now() * 0.0001;
    if ( Math.random() < 0.004 ) {
	let shape_id, already_present;
	do {
	    shape_id = randomInt(0, shape_models.length);
	    already_present = false;
	    for ( let j = 0; j < canvas_infos.length; j++ ) {
		if ( canvas_infos[ j ].settings.shape == shape_id ) {
		    already_present = true;
		    break;
		}
	    }
	} while ( already_present );
	let cinfos = init( next_canvas_id, shape_id, shape_models );
	canvas_infos[ next_canvas_id ] = cinfos;
	next_canvas_id = ( next_canvas_id + 1 ) % canvas_infos.length;
    }

    for ( let i = 0; i < canvas_infos.length; i++ )
    {	  
	let info = canvas_infos[ i ];
	let camera   = info.camera;
	let renderer = info.renderer;
	let settings = info.settings;
	let scene    = info.scene;
	let uniforms = info.uniforms;
	scene.traverse( function ( object ) {
	    if ( object.isMesh === true ) {
		object.rotation.x += 0.01 * settings.rotation_x;
		object.rotation.y += 0.01 * settings.rotation_y;
		object.rotation.z += 0.01 * settings.rotation_z;		  
	    }
	} );
	camera.rotation.y = (i - 3.5) / 8.0 * Math.PI;
	camera.position.x = ( 0.7 +(i%4)*0.3)/2.0 * Math.cos( timer + i * 0.2 ) * distance;
	camera.position.z = ( 0.9 +((i+2)%3)*0.25)/2.0 * Math.sin( timer + i * 0.2 ) * distance;
	uniforms.time.value += 0.01;
	settings.camera_distance = camera.position.length();
	uniforms.camera_distance.value = settings.camera_distance;
	// camera.position.x = ( 1.1+(i % 4) )/2.0 * Math.cos( timer ) * distance;
	// camera.position.z = ( 1.1+((i+2) % 3) )/2.0 * Math.sin( timer ) * distance;
	let id = settings.shape;
	if ( "iso" in shape_models[ id ] ) {
	    let m = shape_models[ id ].iso[ 0 ];
	    let M = shape_models[ id ].iso[ 1 ];
	    uniforms.iso.value = 0.5*(M+m+(M-m)*Math.sin( 0.5*(i%7)*timer ));
	    //console.log( uniforms.iso );
	}
	if ( "grid_size" in shape_models[ id ] ) {
	    let m = shape_models[ id ].grid_size[ 0 ];
	    let M = shape_models[ id ].grid_size[ 1 ];
	    uniforms.grid_size.value =  0.5*(M+m+(M-m)*Math.sin( timer ));
	}
	if ( "grid_thickness" in shape_models[ id ] ) {
	    let m = shape_models[ id ].grid_thickness[ 0 ];
	    let M = shape_models[ id ].grid_thickness[ 1 ];
	    uniforms.grid_thickness.value =  0.5*(M+m+(M-m)*Math.cos( 2.0*timer ));
	}
	if ( "animate_a" in shape_models[ id ] ) {
	    let m  = shape_models[ id ].animate_a[ 0 ];
	    let M  = shape_models[ id ].animate_a[ 1 ];
	    uniforms.a.value = settings.a + M*Math.cos( m*timer );
	}
	if ( "animate_b" in shape_models[ id ] ) {
	    let m  = shape_models[ id ].animate_b[ 0 ];
	    let M  = shape_models[ id ].animate_b[ 1 ];
	    uniforms.b.value = settings.b + M*Math.cos( m*timer );
	}
	
	camera.lookAt( scene.position );
	renderer.render( scene, camera );
	
	// renderer.render( scene, camera );
    }
}

// Changes the geometry of the viewing "window".
function makeViewShape( value, radius ) {
    var geometry;
    switch( value ) {
    case 0: geometry = new THREE.BoxGeometry( radius, radius, radius );
	break;
    case 1: geometry = new THREE.DodecahedronGeometry( radius, 0 );
	break;
    case 2: geometry = new THREE.IcosahedronGeometry( radius, 0 );
	break;
    case 3: geometry = new THREE.IcosahedronGeometry( radius, 4 );
	break;
    case 4: geometry = new THREE.SphereGeometry( radius, 32, 16 );
	break;
    case 5: geometry = new THREE.CylinderGeometry( 0.5*radius, 0.5*radius, radius, 32 );
	break;
    case 6: geometry = new THREE.BoxGeometry( 0.5*radius, radius, radius );
	geometry.translate( -0.25*radius, 0.0, 0.0 );
	break;
    case 7: geometry = new THREE.BoxGeometry( 0.01*radius, radius, radius );
	break;
    }
    return geometry;
}

// Builds the fragment shader from the different chunks.
function makeFragmentShader( settings, uniforms ) {
    // Build fragment shader from chunks
    var doc     = doc_shaders;
    var fragSrc = '#define GRID_MODE '+ settings.grid_mode + '\n';
    fragSrc += doc.getElementById("frag-chunk-begin").value
	+ doc.getElementById("frag-chunk-fct-begin").value
        + makeFunctionShader( settings.shape )
	// + document.getElementById("editable-code-fct").value
	+ doc.getElementById("frag-chunk-fct-end").value
	+ doc.getElementById("frag-chunk-gradf").value
	+ doc.getElementById("frag-chunk-raytrace").value
	+ doc.getElementById("frag-chunk-bg-color").value
	+ doc.getElementById("frag-chunk-phong").value;
    switch ( settings.color_model ) {
    case 0: fragSrc += doc.getElementById("frag-chunk-illumination-basic").value;
	break;
    case 1: fragSrc += doc.getElementById("frag-chunk-illumination-phong").value;
	break;
    case 2: fragSrc += doc.getElementById("frag-chunk-illumination-phong-lights").value;
	break;
    }
    switch ( settings.display_mode ) {
    case 0: fragSrc += doc.getElementById("frag-chunk-display-surface").value;
	break;
    case 1: fragSrc += doc.getElementById("frag-chunk-display-normals").value;
	break;
    case 2: fragSrc += doc.getElementById("frag-chunk-hessf").value
	+ doc.getElementById("frag-chunk-curvatures").value
	+ doc.getElementById("frag-chunk-display-mean-curvatures").value;
	break;
    case 3: fragSrc += doc.getElementById("frag-chunk-hessf").value
	+ doc.getElementById("frag-chunk-curvatures").value
	+ doc.getElementById("frag-chunk-display-gauss-curvatures").value;
	break;
    case 4: fragSrc += doc.getElementById("frag-chunk-hessf").value
	+ doc.getElementById("frag-chunk-curvatures").value
	+ doc.getElementById("frag-chunk-display-convex-concave").value;
	break;
    case 5: fragSrc += doc.getElementById("frag-chunk-hessf").value
	+ doc.getElementById("frag-chunk-curvatures").value
	+ doc.getElementById("frag-chunk-eigendecomposition").value
	+ doc.getElementById("frag-chunk-principal-dirs").value
	+ doc.getElementById("frag-chunk-display-directions").value;
	break;
    }
    fragSrc += doc.getElementById("frag-chunk-singularity").value
	+ doc.getElementById("frag-chunk-fog").value
        + doc.getElementById("frag-chunk-main-common-begin").value
	+ doc.getElementById("frag-chunk-main-common-end").value;    

    //console.log( fragSrc );
    let nshader = new THREE.ShaderMaterial( {
	vertexShader: doc.querySelector( '#post-vert' ).textContent.trim(),
	fragmentShader: fragSrc, // document.querySelector( '#post-frag' ).textContent.trim(),
	uniforms: uniforms
    } );
    nshader.glslVersion = THREE.GLSL3;
    nshader.side        = THREE.DoubleSide;
    return nshader;
}

// Update the renderer (here, only the material/shader of the viewing object).
export function updateRenderer() {
    document.getElementById("editable-code-fct_error").value = "";
    updateShader();
    object.material             = shader;
    object.material.needsUpdate = true;
}

// // Creates the fragment shader from the different chunks.
// function makeFragmentShader( fct_value, color_model, uniforms ) {
//     // Build fragment shader from chunks
//     var doc     = doc_shaders;
//     var fragSrc = doc.getElementById("frag-chunk-begin").value
// 	+ doc.getElementById("frag-chunk-fct-begin").value
// 	+ makeFunctionShader( fct_value )
// 	+ doc.getElementById("frag-chunk-fct-end").value
// 	+ doc.getElementById("frag-chunk-gradf").value
// 	+ doc.getElementById("frag-chunk-raytrace").value
// 	+ doc.getElementById("frag-chunk-bg-color").value;

//     switch ( color_model ) {
//     case 0: // RGB
// 	fragSrc += doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-rgb").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 1: // Phong
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-phong").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 2: // RGB+Grid
// 	fragSrc += doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-rgb-grid").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 3: // Phong+Grid
// 	fragSrc += doc.getElementById("frag-chunk-phong-grid").value
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-phong").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 4: // RGB+Spheres
// 	fragSrc += doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-rgb-spheres").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 5: // Phong+Spheres
// 	fragSrc += doc.getElementById("frag-chunk-phong-spheres").value
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-phong").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 6: // Phong2Layers
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-phong-two-layers").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 7: // SimplePhong
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-simple-phong").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 8: // Mean Curvatures
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-hessf").value
// 	    + doc.getElementById("frag-chunk-curvatures").value	
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-mean-curvatures").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 9: // Gauss Curvatures
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-hessf").value
// 	    + doc.getElementById("frag-chunk-curvatures").value	
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-gauss-curvatures").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 10: // Convex+concave
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-hessf").value
// 	    + doc.getElementById("frag-chunk-curvatures").value	
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-convex-concave").value
// 	    + doc.getElementById("frag-chunk-main-bg-singularity-smooth").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 11: // Directions
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-hessf").value
// 	    + doc.getElementById("frag-chunk-curvatures").value	
// 	    + doc.getElementById("frag-chunk-eigendecomposition").value	
// 	    + doc.getElementById("frag-chunk-principal-dirs").value	
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-directions").value
//             + doc.getElementById("frag-chunk-main-bg").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     case 12: // PhongReflection
// 	fragSrc += doc.getElementById("frag-chunk-phong").value
// 	    + doc.getElementById("frag-chunk-main-common-begin").value
// 	    + doc.getElementById("frag-chunk-main-phong-reflection").value
// 	    + doc.getElementById("frag-chunk-main-common-end").value;
// 	break;
//     }
//     let shader = new THREE.ShaderMaterial( {
// 	vertexShader: doc.querySelector( '#post-vert' ).textContent.trim(),
// 	fragmentShader: fragSrc, 
// 	uniforms: uniforms
//     } );
//     shader.side        = THREE.DoubleSide;
//     shader.glslVersion = THREE.GLSL3;
//     return shader;
// }


// @return the fragment shader code for the predefined function `value`
function makeFunctionShader( value ) {
    var code = "";
    if ( "frag" in shape_models[ value ] ) {
	var str = "frag-chunk-fct-"+shape_models[ value ].frag;
	code    = doc_functions.getElementById( str ).value;
    } else {
	console.log( "No frag in "+shape_models[ value ] );
    }
    return code;
}
