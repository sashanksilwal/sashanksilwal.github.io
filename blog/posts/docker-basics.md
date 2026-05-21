I spent the better part of a week getting WRF to run on a lab server. WRF is a weather model written in Fortran, the kind of mature scientific software that's been around for decades and comes with a long chain of dependencies that all have to agree with each other. The right compiler, the right MPI library for running across multiple cores, NetCDF for the data files, HDF5 underneath that, and a few more. Get one version slightly wrong and you find out 25 minutes into a compile, or worse, when the model crashes at runtime. I needed it to generate output I could use as training data for a model I was building at [Purdue](/experience/). Eventually I got it running. I was proud of it.

Then the server broke down. Hardware failure, not coming back. I had to move everything to a different server, which meant redoing the entire setup from scratch on a fresh machine: every dependency, every version, every environment variable I'd forgotten I set. A full day, minimum, to get back to where I already was.

That was the moment Docker stopped being a buzzword I nodded along to and became the thing I should have used from day one. If I'd containerized WRF, moving servers would have been a few commands and a download, not a lost day. So I learned Docker properly. This post is the intro I wish I'd had, plus the tips that actually mattered once I started using it for real.

## What Docker actually is

The clearest way I can put it: Docker lets you package a piece of software together with everything it needs to run, so it behaves the same way on any machine.

"Everything it needs" is the important part. Not just your code, but the operating system libraries, the specific compiler version, the dependencies, the environment variables, all of it. The whole environment gets frozen into one bundle. You move that bundle to a new machine and it runs identically, because it's carrying its world with it. The phrase you'll hear is "it solves the works-on-my-machine problem," and that's exactly the problem I'd just lived through.

A useful analogy: a virtual machine is like shipping an entire house, foundation and plumbing and all, every time you want to move a room. It works, but it's heavy and slow. Docker is more like a shipping container. Standardized box, your stuff packed inside, and it slots onto any truck or ship without anyone repacking it. Containers share the host machine's operating system kernel instead of each booting a full OS, so they start in seconds and barely add overhead. That's why people moved to them.

## The three words you need

Most of Docker clicks once you separate three ideas that beginners (me included) tend to blur together.

A **Dockerfile** is a plain text recipe. It's a list of steps: start from this base, install these packages, copy in this code, run this command. You write it once.

An **image** is what you get when you run that recipe. It's a frozen snapshot of the whole environment, built and ready. Images are what you share and store.

A **container** is a running instance of an image. The image is the recipe's finished cake sitting in the fridge; the container is the slice you're actually eating. You can start many containers from one image, and they don't interfere with each other.

So the flow is: write a Dockerfile, build it into an image, run the image as a container. A tiny example:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

```bash
docker build -t myapp .      # Dockerfile -> image named "myapp"
docker run myapp             # image -> running container
```

That `FROM python:3.11-slim` line is doing a lot of quiet work. You're starting from an image someone else already built, with Python installed, so you don't reinstall the world. Most Dockerfiles begin by standing on an existing image from a registry like Docker Hub.

## The tips that actually mattered

The basics get you a container that runs. These are the things I learned afterward that separated "it works" from "it works well."

**Order your Dockerfile from least to most likely to change.** Docker builds in layers and caches each one. If a step hasn't changed, it reuses the cached result instead of redoing it. So put slow, stable steps (installing system packages, heavy dependencies) near the top, and the things you edit constantly (your own code) near the bottom. In my Python example, copying `requirements.txt` and installing before copying the rest of the code is deliberate. Change your code and the dependency install stays cached. Get the order backwards and you reinstall everything on every tiny edit. For something like WRF, where the build takes half an hour, this is the difference between a coffee break and a lunch break on every rebuild.

**Pin your versions. Never trust `latest`.** Writing `FROM python:3.11-slim` instead of `FROM python:latest` means you get the same Python every time you build, this year and next. The `latest` tag quietly moves, and a build that worked in March can break in June for reasons that have nothing to do with your code. The entire point of Docker is reproducibility. A floating version tag throws that away. The dependency chaos I hit with WRF was version mismatches; pinning is how you stop reliving that.

**Use a `.dockerignore` file.** When you build, Docker copies your project folder into the build. Without a `.dockerignore`, that sweeps up your `.git` history, local virtual environments, log files, and giant datasets you never meant to include. It bloats the image and slows the build. A `.dockerignore` works like `.gitignore`: list what to leave out.

**Shrink images with multi-stage builds.** This one felt like a magic trick the first time. You can have one stage that does the heavy building (compilers, source code, the works) and a second, clean stage that copies in only the finished result. Everything you needed to build but not to run gets left behind:

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN go build -o app .

FROM debian:12-slim
COPY --from=builder /src/app /app
CMD ["/app"]
```

The final image carries the compiled program and nothing else, no Go toolchain, no source. For compiled software the size difference is enormous, often gigabytes down to tens of megabytes.

**Keep data out of the image.** An image should hold your software, not your data. If you bake a 10 GB dataset into the image, every rebuild and every copy drags it around. Use a volume instead, which mounts a folder from the host machine into the container at runtime:

```bash
docker run -v /path/on/host/data:/data myapp
```

Now the container reads and writes real files on the host, and your image stays lean. This also means your results survive after the container stops, which matters more than beginners expect, because by default anything written inside a container disappears when it's gone.

**Don't bake secrets into the image.** API keys, passwords, tokens. They do not belong in the Dockerfile. Anyone with the image can dig them out of the layers, even if a later step deletes them. Pass secrets in at runtime through environment variables or a secrets manager instead.

**Reach for Docker Compose when you have more than one piece.** The moment your app needs a database alongside it, or a cache, or any second service, running separate `docker run` commands by hand gets old fast. A `docker-compose.yml` file describes all the pieces and how they connect, and `docker compose up` starts the whole thing at once.

## One catch worth knowing early

Docker is the standard on your own machine and on most cloud servers, but it needs root-level access to run, and shared computing clusters usually won't grant that. So on the HPC cluster where I actually run WRF, plain Docker isn't allowed. The fix there is a sibling tool called Singularity (now Apptainer) that runs containers as a normal user with no special privileges. You can build a Docker image and convert it, so the work isn't wasted, but it's worth knowing the cluster world plays by slightly different rules before you get there. If you're wondering when you even need that kind of computing muscle, I wrote about [the honest threshold for going distributed](/blog/post.html?post=distributed-computing-basics).

## Where this leaves you

Docker didn't make WRF run any faster or fix a single bug in the model. What it changed is that the environment is now written down, in a file, and reproducible. If a server dies tomorrow, moving is a `docker build` and a download, not a day of archaeology trying to remember what I installed eight months ago.

That's the real pitch, and it's why I'd tell anyone working with finicky dependencies to learn this earlier than I did. You don't containerize because it's trendy. You do it so that the next time the machine under you disappears, your work doesn't go with it. Start with a Dockerfile for one small project, get the layer caching and version pinning right, and the rest builds from there.
