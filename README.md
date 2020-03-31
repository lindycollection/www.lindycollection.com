# Lindy Collection

Thank you for visiting the source of https://www.lindycollection.com .
You are in the right place if you are hoping to contribute.
This site is designed to be a place to aggregate resources from the Lindy Hop community and help people find jumping off points to dig deeper.

It's being developed in an open model.
Please feel free to make suggestions I will do my best to accept things but contribtions need to fit with my best vision for the site.



## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/lindycollection/www.lindycollection.com . This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.

## Development

This site is hosted on github pages using Jekyll but you can test it out yourself locally.

To test this site locally on linux:

Prerequisites will be to have [docker installed](https://docs.docker.com/install/) as well as python3 with the venv module.


```bash
# create a workspace
mkdir -p ~/lindycollection/lc_venv
cd ~/lindycollection
# Create a virtual env and activate it
python3 -m venv lc_venv
. ~/lindycollection/lc_venv/bin/activate
# install rocker 
pip install git+git@github.com:osrf/rocker.git@ghjekyll
# Close the website
git clone https://github.com/lindycollection/www.lindycollection.com
ghrocker ~/lindycollection/www.lindycollection.com
```

To run it again go to
```
. ~/lindycollection/lc_venv/bin/activate
ghrocker ~/lindycollection/www.lindycollection.com

```

## License

The theme is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

The content for this site is available under the CC-BY-NC-SA 4.0