# Video-Narrator
Use google cloud text-to-speech api to narrate an audio track for a video

To use [Google cloud text-to-speech](https://cloud.google.com/text-to-speech/) you will first need to:
  * create a Google Cloud project,
  * activate billing,
  * enable the text-to-speech api, and
  * create an access key.

Save the resulting key in a local directory (say auth).

Run build.sh to create the Docker container.

Edit the narrator.example.sh script to contain the path to your key's directory and filename.

Create a narration script.  A narration script contains one or voice fragments of the form:
```
start-time fragment-name
<speak>
SSML text.
</speak>
blank line
```

The format of start time is `[[hours:]minutes:]seconds[.milliseconds]`.

Use your edited `narrator.sh` script to convert the script into an audio (ogg) file:
```sh
narrator.sh [options] myvideo.script
```

On success, the narrated audio file will be in `myvideo.ogg`.  You can open `.ogg` files in both the Chrome and Firefox browsers.

The script does not automatically add the audio track to your video file.  (Indeed, the video file need not even exist.) You can use existing tools (e.g. ffmpeg (command line) or Camtasia (Mac app)) to combine the video and audio tracks.

The program accepts the following options before the script file:

<dl>
<dt>-y</dt>
<dd>Overwrite the audio output file.  If not specified, the system will output an error if
the audio output file already exists.</dd>
<dt>-audio file</dt>
<dd>Include additional audio options.  File should contain a text-to-speech AudioConfig object in JSON format.  Note: you cannot change the audio format. File should be in the current directory so that it's available inside the docker container.</dd>
<dt>-voice file</dt>
<dd>Override the default voice options.  File should contain a text-to-speech VoiceSelectionParams object in JSON format. File should be in the current directory so that it's available inside the docker container.</dd>
</dl>

Voice Narrator caches the translation of individual fragments in a subdirectory `fragment-cache` to avoid translating the same text multiple times during iterative script development.  If you change the audio or voice parameters you should empty the contents of this cache (`rm fragment-cache/*`) before running the narrator script.
