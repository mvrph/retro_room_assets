// [COMBO] {"material":"Position","combo":"SHAPE","type":"options","default":0,"options":{"Bottom":0,"Top":1,"Left":2,"Right":3,"Stereo - Horizontal":4,"Stereo - Vertical":5,"Circle - Inner":6,"Circle - Outer":7}}
// [COMBO] {"material":"Transparency","combo":"TRANSPARENCY","type":"options","default":2,"options":{"Preserve original":0,"Replace original":1,"Add to original":2,"Subtract from original":3,"Intersect original":4,"Remove all transparency":5}}
// [COMBO] {"material":"Frequency Resolution","combo":"RESOLUTION","type":"options","default":32,"options":{"16":16,"32":32,"64":64}}
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Simulate audio (preview)","combo":"AUDIO_SIMULATE","type":"options","default":0}

#include "common.h"
#include "common_blending.h"



varying vec2 v_TexCoord;

uniform float g_BarCount; // {"material":"Bar Count","default":16,"range":[1, 1000]}
uniform vec2 g_BarBounds; // {"default":"0 1","material":"Bar Bounds"}

uniform vec3 g_BarColor; // {"default":"1 1 1","material":"Bar Color","type":"color"}

uniform float g_BarOpacity; // {"default":"1","material":"Bar Opacity"}

uniform float g_BarSpacing; // {"default":"0","material":"Bar Spacing"}


uniform sampler2D g_Texture0; // {"material":"previous","label":"Prev","hidden":true}
#if AUDIO_SIMULATE == 1
uniform float g_Time;
uniform sampler2D g_Texture1; // {"default":"util/noise","hidden":false,"material":"noise"}

#endif

#if AUDIO_SIMULATE == 0
#if RESOLUTION == 16
uniform float g_AudioSpectrum16Left[16];
uniform float g_AudioSpectrum16Right[16];
#endif

#if RESOLUTION == 32
uniform float g_AudioSpectrum32Left[32];
uniform float g_AudioSpectrum32Right[32];
#endif

#if RESOLUTION == 64
uniform float g_AudioSpectrum64Left[64];
uniform float g_AudioSpectrum64Right[64];
#endif
#endif



// Position
#define BOTTOM 0
#define TOP 1
#define LEFT 2
#define RIGHT 3
#define STEREO_H 4
#define STEREO_V 5
#define CIRCLE_INNER 6
#define CIRCLE_OUTER 7


// Transparency
#define PRESERVE 0
#define REPLACE 1
#define ADD 2
#define SUBTRACT 3
#define INTERSECT 4
#define REMOVE 5



#ifdef HLSL
	#define fract frac
#endif



void main() {
	
#if AUDIO_SIMULATE == 0
#if RESOLUTION == 16
	float g_AudioSpectrumLeft[] = g_AudioSpectrum16Left;
	float g_AudioSpectrumRight[] = g_AudioSpectrum16Right;
#endif

#if RESOLUTION == 32
	float g_AudioSpectrumLeft[] = g_AudioSpectrum32Left;
	float g_AudioSpectrumRight[] = g_AudioSpectrum32Right;
#endif

#if RESOLUTION == 64
	float g_AudioSpectrumLeft[] = g_AudioSpectrum64Left;
	float g_AudioSpectrumRight[] = g_AudioSpectrum64Right;
#endif
#endif


	// Get the existing pixel color
	vec4 scene = texSample2D(g_Texture0, v_TexCoord);


	// Map the coordinates to the selected shape
#if SHAPE == BOTTOM
	vec2 shapeCoord = v_TexCoord;
#endif

#if SHAPE == TOP
	vec2 shapeCoord = v_TexCoord;
	shapeCoord.y = 1 - shapeCoord.y;
#endif

#if SHAPE == LEFT
	vec2 shapeCoord = v_TexCoord.yx;
	shapeCoord.y = 1 - shapeCoord.y;
#endif

#if SHAPE == RIGHT
	vec2 shapeCoord = v_TexCoord.yx;
#endif

#if SHAPE == STEREO_H
	vec2 shapeCoord = v_TexCoord.yx;
#endif

#if SHAPE == STEREO_V
	vec2 shapeCoord = v_TexCoord.xy;
#endif

#if SHAPE == CIRCLE_INNER || SHAPE == CIRCLE_OUTER
	vec2 circleCoord = (v_TexCoord - 0.5) * 2;
	vec2 shapeCoord;
	shapeCoord.x = (atan2(circleCoord.y, circleCoord.x) + M_PI) / M_PI_2;
	shapeCoord.y = sqrt(circleCoord.x * circleCoord.x + circleCoord.y * circleCoord.y);
#if SHAPE == CIRCLE_INNER
	shapeCoord.y = 1.0 - shapeCoord.y;
#endif
#endif



	// Get the frequency for this pixel
	float barDist = abs((shapeCoord.x * g_BarCount % 1) * 2 - 1);
	float frequency = floor(shapeCoord.x * g_BarCount) / g_BarCount * RESOLUTION;
	uint barFreq1 = frequency % RESOLUTION;
	uint barFreq2 = (barFreq1 + 1) % RESOLUTION;



	// Get the height of the bar
#if SHAPE == STEREO_H || SHAPE == STEREO_V



#if AUDIO_SIMULATE == 1
	float yL = frac(g_Time * 0.181);
	float yR = frac(yL + 0.5);
	float x1 = barFreq1 / 128.0;
	float x2 = barFreq2 / 128.0;
	float barVolume1L = texSample2D(g_Texture1, vec2(x1, yL));
	float barVolume2L = texSample2D(g_Texture1, vec2(x2, yL));
	float barVolume1R = texSample2D(g_Texture1, vec2(x1, yR));
	float barVolume2R = texSample2D(g_Texture1, vec2(x2, yR));
#else
	float barVolume1L = g_AudioSpectrumLeft[barFreq1];
	float barVolume2L = g_AudioSpectrumLeft[barFreq2];
	float barVolume1R = g_AudioSpectrumRight[barFreq1];
	float barVolume2R = g_AudioSpectrumRight[barFreq2];
#endif
	
	// bar = 1 if this pixel is inside a bar, 0 if outside
	int bar = step(shapeCoord.y, 0.5 * lerp(g_BarBounds.x, g_BarBounds.y, lerp(barVolume1L, barVolume2L, smoothstep(0, 1, fract(frequency)))));
	bar = max(bar, step(1 - shapeCoord.y, 0.5 * lerp(g_BarBounds.x, g_BarBounds.y, lerp(barVolume1R, barVolume2R, smoothstep(0, 1, fract(frequency))))));
	bar *= step(barDist, 1 - g_BarSpacing);

#else // NON-STEREO

#if AUDIO_SIMULATE == 1
	float x1 = barFreq1 / 128.0;
	float x2 = barFreq2 / 128.0;
	float y = g_Time * 0.181;
	float barVolume1 = texSample2D(g_Texture1, vec2(x1, y));
	float barVolume2 = texSample2D(g_Texture1, vec2(x2, y));
#else
	float barVolume1 = (g_AudioSpectrumLeft[barFreq1] + g_AudioSpectrumRight[barFreq1]) * 0.5;
	float barVolume2 = (g_AudioSpectrumLeft[barFreq2] + g_AudioSpectrumRight[barFreq2]) * 0.5;
#endif

	// bar = 1 if this pixel is inside a bar, 0 if outside
	int bar = step(1 - shapeCoord.y, lerp(g_BarBounds.x, g_BarBounds.y, lerp(barVolume1, barVolume2, smoothstep(0, 1, fract(frequency)))));
	bar *= step(barDist, 1 - g_BarSpacing);

#endif



	vec3 finalColor = bar * g_BarColor;
	finalColor = ApplyBlending(BLENDMODE, scene.rgb, finalColor.rgb, bar * g_BarOpacity);



//TODO: Replace else if with elif when supported
#if TRANSPARENCY == PRESERVE
	float alpha = scene.a;
#else
#if TRANSPARENCY == REPLACE
	float alpha = bar * g_BarOpacity;
#else
#if TRANSPARENCY == ADD
	float alpha = max(scene.a, bar * g_BarOpacity);
#else
#if TRANSPARENCY == SUBTRACT
	float alpha = max(0, scene.a - bar * g_BarOpacity);
#else
#if TRANSPARENCY == INTERSECT
	float alpha = scene.a * bar * g_BarOpacity;
#else
#if TRANSPARENCY == REMOVE
	float alpha = g_BarOpacity;
#endif
#endif
#endif
#endif
#endif
#endif



	gl_FragColor = vec4(finalColor, alpha);
}
